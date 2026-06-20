import { createClient } from "redis";
import type {
  ColumnInfo,
  DbType,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  QueryColumn,
  QueryOptions,
  QueryResult,
  RuntimeConnectionProfile,
  SchemaInfo,
  TableInfo,
  TestConnectionResult
} from "../../core/types";
import { newId } from "../../utils/objectId";
import { tokenizeCommand } from "../../utils/commandTokenizer";
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";

const MAX_KEYS = 500;
const SCAN_COUNT = 200;

/** Client tối giản (bọc node-redis) — cho phép inject mock khi test. */
export interface RedisClient {
  ping(): Promise<string>;
  scan(cursor: number, options: { COUNT: number }): Promise<{ cursor: number; keys: string[] }>;
  type(key: string): Promise<string>;
  sendCommand(args: string[]): Promise<unknown>;
  quit(): Promise<void>;
}

export interface RedisConnectionConfig {
  host?: string;
  port?: number;
  password?: string;
  database?: number;
}

export type RedisClientFactory = (config: RedisConnectionConfig) => Promise<RedisClient>;

const defaultFactory: RedisClientFactory = async (config) => {
  const client = createClient({
    socket: { host: config.host ?? "localhost", port: config.port ?? 6379 },
    password: config.password,
    database: config.database ?? 0
  });
  await client.connect();
  return {
    ping: () => client.ping(),
    scan: (cursor, options) => client.scan(cursor, options),
    type: (key) => client.type(key),
    sendCommand: (args) => client.sendCommand(args),
    quit: async () => {
      await client.quit();
    }
  };
};

/**
 * Adapter Redis (key-value). Redis không có table/column/FK/SQL, nên adapter chỉ
 * hỗ trợ: test (PING), liệt kê keys (SCAN) làm "tables", và chạy lệnh Redis qua
 * Query Editor (executeQuery). Các tính năng SQL khác trả rỗng.
 */
export class RedisAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "redis";
  readonly paginationStyle: PaginationStyle = "limit-offset";

  private readonly sessions = new Map<string, RedisClient>();

  constructor(private readonly factory: RedisClientFactory = defaultFactory) {}

  quoteIdentifier(name: string): string {
    return name;
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const client = await this.factory(toConfig(profile));
    const id = newId();
    this.sessions.set(id, client);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    let client: RedisClient | undefined;
    try {
      client = await this.factory(toConfig(profile));
      const pong = await client.ping();
      return { ok: true, message: `Connected to Redis (PING -> ${pong}).` };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    } finally {
      if (client) {
        await safeQuit(client);
      }
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    const client = this.sessions.get(session.id);
    if (client) {
      this.sessions.delete(session.id);
      await safeQuit(client);
    }
  }

  async listSchemas(_session: DbSession): Promise<SchemaInfo[]> {
    return [];
  }

  /** Liệt kê keys (SCAN, giới hạn MAX_KEYS) hiển thị như "tables". */
  async listTables(session: DbSession, _schema?: string): Promise<TableInfo[]> {
    const client = this.client(session);
    const keys: string[] = [];
    let cursor = 0;
    do {
      const result = await client.scan(cursor, { COUNT: SCAN_COUNT });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0 && keys.length < MAX_KEYS);
    return keys.slice(0, MAX_KEYS).map((key) => ({ name: key, type: "base_table" }));
  }

  async listViews(_session: DbSession, _schema?: string): Promise<TableInfo[]> {
    return [];
  }

  async listColumns(_session: DbSession, _ref: ObjectRef): Promise<ColumnInfo[]> {
    return [];
  }

  async listIndexes(_session: DbSession, _ref: ObjectRef): Promise<IndexInfo[]> {
    return [];
  }

  async listForeignKeys(_session: DbSession, _ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    return [];
  }

  async listViewDependencies(_session: DbSession, _ref: ObjectRef): Promise<ObjectRef[]> {
    return [];
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const type = await this.client(session).type(ref.name);
    return `# Redis key\nname: ${ref.name}\ntype: ${type}`;
  }

  /** Chạy một lệnh Redis (vd "GET foo", "KEYS *"). */
  async executeQuery(
    session: DbSession,
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    if (options?.signal?.aborted) {
      throw new Error("Command cancelled.");
    }
    const args = tokenizeCommand(sql);
    if (args.length === 0) {
      throw new Error("Empty Redis command.");
    }
    const started = Date.now();
    const reply = await this.client(session).sendCommand(args);
    const { columns, rows } = toRows(reply);
    let limited = rows;
    const truncated = options?.maxRows !== undefined && rows.length > options.maxRows;
    if (truncated) {
      limited = rows.slice(0, options.maxRows);
    }
    return {
      queryId: newId(),
      columns,
      rows: limited,
      rowCount: limited.length,
      durationMs: Date.now() - started,
      truncated
    };
  }

  private client(session: DbSession): RedisClient {
    const client = this.sessions.get(session.id);
    if (!client) {
      throw new Error("Redis session is not connected.");
    }
    return client;
  }
}

function toRows(reply: unknown): { columns: QueryColumn[]; rows: Record<string, unknown>[] } {
  if (reply === null || reply === undefined) {
    return { columns: [{ name: "result", ordinal: 0 }], rows: [] };
  }
  if (Array.isArray(reply)) {
    return {
      columns: [{ name: "value", ordinal: 0 }],
      rows: reply.map((value) => ({ value: stringifyReply(value) }))
    };
  }
  return {
    columns: [{ name: "result", ordinal: 0 }],
    rows: [{ result: stringifyReply(reply) }]
  };
}

function stringifyReply(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function toConfig(profile: RuntimeConnectionProfile): RedisConnectionConfig {
  const db = profile.database ? Number(profile.database) : 0;
  return {
    host: profile.host,
    port: profile.port ?? 6379,
    password: profile.password,
    database: Number.isNaN(db) ? 0 : db
  };
}

async function safeQuit(client: RedisClient): Promise<void> {
  try {
    await client.quit();
  } catch {
    // bỏ qua lỗi khi đóng kết nối đã hỏng
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
