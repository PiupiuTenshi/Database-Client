import { MongoClient, ObjectId, type Document, type MongoClientOptions } from "mongodb";
import type {
  CheckConstraintInfo,
  ColumnInfo,
  DbType,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  PlaceholderStyle,
  QueryColumn,
  QueryOptions,
  QueryResult,
  RuntimeConnectionProfile,
  SchemaInfo,
  TableInfo,
  TestConnectionResult,
  TriggerInfo
} from "../../core/types";
import { newId } from "../../utils/objectId";
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";

export interface MongoClientLike {
  connect(): Promise<MongoClientLike>;
  db(name?: string): DbLike;
  close(): Promise<void>;
}

export interface DbLike {
  databaseName: string;
  admin(): { listDatabases(): Promise<{ databases: { name: string }[] }> };
  listCollections(): { toArray(): Promise<{ name: string; type?: string }[]> };
  collection(name: string): CollectionLike;
  command(command: Document): Promise<Document>;
}

export interface CollectionLike {
  find(filter?: Document, options?: Document): {
    sort(sort: Document): { skip(skip: number): { limit(limit: number): { toArray(): Promise<Document[]> } } };
    skip(skip: number): { limit(limit: number): { toArray(): Promise<Document[]> } };
    limit(limit: number): { toArray(): Promise<Document[]> };
    toArray(): Promise<Document[]>;
  };
  findOne(filter?: Document): Promise<Document | null>;
  countDocuments(filter?: Document): Promise<number>;
  indexes(): Promise<Document[]>;
  insertOne(document: Document): Promise<{ insertedId: unknown }>;
}

export type MongoClientFactory = (uri: string, options: MongoClientOptions) => MongoClientLike;

const defaultFactory: MongoClientFactory = (uri, options) => new MongoClient(uri, options);

export class MongoDbAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "mongodb";
  readonly paginationStyle: PaginationStyle = "limit-offset";
  readonly placeholderStyle: PlaceholderStyle = "qmark";

  private readonly sessions = new Map<string, { client: MongoClientLike; defaultDb?: string }>();

  constructor(private readonly factory: MongoClientFactory = defaultFactory) {}

  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const client = await this.factory(toUri(profile), toOptions(profile)).connect();
    const id = newId();
    this.sessions.set(id, { client, defaultDb: profile.database });
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    let client: MongoClientLike | undefined;
    try {
      client = await this.factory(toUri(profile), toOptions(profile)).connect();
      await client.db(profile.database).command({ ping: 1 });
      return { ok: true, message: "Connected to MongoDB successfully." };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    } finally {
      if (client) {
        await safeClose(client);
      }
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    const entry = this.sessions.get(session.id);
    if (entry) {
      this.sessions.delete(session.id);
      await safeClose(entry.client);
    }
  }

  async listSchemas(session: DbSession): Promise<SchemaInfo[]> {
    const entry = this.entry(session);
    const result = await entry.client.db(entry.defaultDb).admin().listDatabases();
    return result.databases.map((db) => ({
      name: db.name,
      isDefault: db.name === entry.defaultDb
    }));
  }

  async listTables(session: DbSession, schema?: string): Promise<TableInfo[]> {
    const db = this.db(session, schema);
    const collections = await db.listCollections().toArray();
    return collections.map((collection) => ({
      name: collection.name,
      schema: db.databaseName,
      type: "base_table"
    }));
  }

  async listViews(_session: DbSession, _schema?: string): Promise<TableInfo[]> {
    return [];
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const doc = await this.db(session, ref.schema).collection(ref.name).findOne({});
    if (!doc) {
      return [{ name: "_id", dataType: "ObjectId", ordinal: 0, nullable: false, isPrimaryKey: true }];
    }
    return Object.keys(doc).map((name, ordinal) => ({
      name,
      dataType: inferMongoType(doc[name]),
      ordinal,
      nullable: doc[name] == null,
      isPrimaryKey: name === "_id"
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    const indexes = await this.db(session, ref.schema).collection(ref.name).indexes();
    return indexes.map((index) => ({
      name: String(index.name ?? ""),
      unique: Boolean(index.unique),
      columns: Object.keys((index.key as Document | undefined) ?? {})
    }));
  }

  async listForeignKeys(_session: DbSession, _ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    return [];
  }

  async listTriggers(_session: DbSession, _ref: ObjectRef): Promise<TriggerInfo[]> {
    return [];
  }

  async listCheckConstraints(_session: DbSession, _ref: ObjectRef): Promise<CheckConstraintInfo[]> {
    return [];
  }

  async listViewDependencies(_session: DbSession, _ref: ObjectRef): Promise<ObjectRef[]> {
    return [];
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const indexes = await this.listIndexes(session, ref);
    return JSON.stringify(
      {
        database: ref.schema ?? this.entry(session).defaultDb,
        collection: ref.name,
        indexes
      },
      null,
      2
    );
  }

  async executeQuery(
    session: DbSession,
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    if (options?.signal?.aborted) {
      throw new Error("Query cancelled.");
    }
    const started = Date.now();
    const countRequest = parseGeneratedCount(sql);
    if (countRequest) {
      const total = await this
        .db(session, countRequest.schema)
        .collection(countRequest.collection)
        .countDocuments({});
      return {
        queryId: newId(),
        columns: [{ name: "count", ordinal: 0 }],
        rows: [{ count: total }],
        rowCount: 1,
        durationMs: Date.now() - started
      };
    }

    const findRequest = parseGeneratedFind(sql) ?? parseJsonFind(sql);
    if (!findRequest) {
      throw new Error(
        'MongoDB Query Editor expects JSON like {"collection":"users","filter":{},"limit":50}.'
      );
    }
    const requestedLimit = findRequest.limit ?? options?.maxRows ?? 100;
    const docs = await findDocuments(this.db(session, findRequest.schema), findRequest);
    const truncated = options?.maxRows !== undefined && docs.length > options.maxRows;
    const limited = truncated ? docs.slice(0, options.maxRows) : docs;
    const rows = limited.map(normalizeDocument);
    return {
      queryId: newId(),
      columns: columnsFromRows(rows),
      rows,
      rowCount: rows.length,
      durationMs: Date.now() - started,
      truncated: truncated || docs.length >= requestedLimit
    };
  }

  private db(session: DbSession, schema?: string): DbLike {
    const entry = this.entry(session);
    return entry.client.db(schema ?? entry.defaultDb);
  }

  private entry(session: DbSession): { client: MongoClientLike; defaultDb?: string } {
    const entry = this.sessions.get(session.id);
    if (!entry) {
      throw new Error("MongoDB session is not connected.");
    }
    return entry;
  }
}

interface MongoFindRequest {
  schema?: string;
  collection: string;
  filter?: Document;
  projection?: Document;
  sort?: Document;
  limit?: number;
  skip?: number;
}

async function findDocuments(db: DbLike, request: MongoFindRequest): Promise<Document[]> {
  const cursor = db.collection(request.collection).find(request.filter ?? {}, {
    projection: request.projection
  });
  if (request.sort) {
    return cursor
      .sort(request.sort)
      .skip(request.skip ?? 0)
      .limit(request.limit ?? 100)
      .toArray();
  }
  return cursor.skip(request.skip ?? 0).limit(request.limit ?? 100).toArray();
}

function parseGeneratedFind(sql: string): MongoFindRequest | undefined {
  const match = /^\s*SELECT\s+\*\s+FROM\s+(.+?)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*;?\s*$/i.exec(
    sql
  );
  if (!match) {
    return undefined;
  }
  const target = parseTarget(match[1]);
  return {
    schema: target.schema,
    collection: target.collection,
    limit: Number(match[2]),
    skip: Number(match[3])
  };
}

function parseGeneratedCount(sql: string): MongoFindRequest | undefined {
  const match = /^\s*SELECT\s+COUNT\(\*\)\s+AS\s+count\s+FROM\s+(.+?)\s*;?\s*$/i.exec(sql);
  if (!match) {
    return undefined;
  }
  const target = parseTarget(match[1]);
  return { schema: target.schema, collection: target.collection };
}

function parseTarget(target: string): { schema?: string; collection: string } {
  const parts = target
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  if (parts.length >= 2) {
    return { schema: parts[0], collection: parts.slice(1).join(".") };
  }
  return { collection: parts[0] };
}

function parseJsonFind(sql: string): MongoFindRequest | undefined {
  try {
    const parsed = JSON.parse(sql) as Partial<MongoFindRequest>;
    if (typeof parsed.collection !== "string" || !parsed.collection.trim()) {
      return undefined;
    }
    return {
      schema: typeof parsed.schema === "string" ? parsed.schema : undefined,
      collection: parsed.collection,
      filter: isDocument(parsed.filter) ? parsed.filter : {},
      projection: isDocument(parsed.projection) ? parsed.projection : undefined,
      sort: isDocument(parsed.sort) ? parsed.sort : undefined,
      limit: typeof parsed.limit === "number" ? parsed.limit : undefined,
      skip: typeof parsed.skip === "number" ? parsed.skip : undefined
    };
  } catch {
    return undefined;
  }
}

function isDocument(value: unknown): value is Document {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toUri(profile: RuntimeConnectionProfile): string {
  if (profile.host?.startsWith("mongodb://") || profile.host?.startsWith("mongodb+srv://")) {
    return profile.host;
  }
  const host = profile.host?.trim() || "localhost";
  const port = profile.port ?? 27017;
  const credentials =
    profile.username && profile.password
      ? `${encodeURIComponent(profile.username)}:${encodeURIComponent(profile.password)}@`
      : "";
  return `mongodb://${credentials}${host}:${port}`;
}

function toOptions(profile: RuntimeConnectionProfile): MongoClientOptions {
  return {
    tls: profile.ssl || undefined
  };
}

function inferMongoType(value: unknown): string {
  if (value instanceof ObjectId) {
    return "ObjectId";
  }
  if (value instanceof Date) {
    return "Date";
  }
  if (Array.isArray(value)) {
    return "Array";
  }
  if (value === null || value === undefined) {
    return "null";
  }
  return typeof value === "object" ? "Object" : typeof value;
}

function normalizeDocument(doc: Document): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(doc).map(([key, value]) => [key, normalizeValue(value)])
  );
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof ObjectId) {
    return value.toHexString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (isDocument(value)) {
    return JSON.stringify(normalizeDocument(value));
  }
  return value;
}

function columnsFromRows(rows: Record<string, unknown>[]): QueryColumn[] {
  const names = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      names.add(key);
    }
  }
  return [...names].map((name, ordinal) => ({ name, ordinal }));
}

async function safeClose(client: MongoClientLike): Promise<void> {
  try {
    await client.close();
  } catch {
    // ignore close errors
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
