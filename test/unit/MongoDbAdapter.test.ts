import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { MongoDbAdapter, type CollectionLike, type DbLike, type MongoClientLike } from "../../src/adapters/mongodb/MongoDbAdapter";

class FakeMongoClient implements MongoClientLike {
  readonly dbs = new Map<string, FakeMongoDb>();

  async connect(): Promise<MongoClientLike> {
    return this;
  }

  db(name = "app"): DbLike {
    if (!this.dbs.has(name)) {
      this.dbs.set(name, new FakeMongoDb(name));
    }
    return this.dbs.get(name)!;
  }

  async close(): Promise<void> {}
}

class FakeMongoDb implements DbLike {
  constructor(readonly databaseName: string) {}

  admin(): { listDatabases(): Promise<{ databases: { name: string }[] }> } {
    return { listDatabases: async () => ({ databases: [{ name: "app" }] }) };
  }

  listCollections(): { toArray(): Promise<{ name: string; type?: string }[]> } {
    return { toArray: async () => [{ name: "users" }] };
  }

  collection(_name: string): CollectionLike {
    return new FakeCollection();
  }

  async command(): Promise<Record<string, unknown>> {
    return { ok: 1 };
  }
}

class NoListDatabasesMongoDb extends FakeMongoDb {
  override admin(): { listDatabases(): Promise<{ databases: { name: string }[] }> } {
    return {
      listDatabases: async () => {
        throw new Error("not authorized on admin to execute command");
      }
    };
  }
}

class NoListDatabasesClient extends FakeMongoClient {
  override db(name = "app"): DbLike {
    return new NoListDatabasesMongoDb(name);
  }
}

class FakeCollection implements CollectionLike {
  readonly deletedFilters: Record<string, unknown>[] = [];
  readonly insertedDocuments: Record<string, unknown>[] = [];

  find(): ReturnType<CollectionLike["find"]> {
    const docs = [{ _id: "1", name: "A" }];
    const terminal = { toArray: async () => docs };
    const limit = () => terminal;
    const skip = () => ({ limit });
    return {
      sort: () => ({ skip }),
      skip,
      limit,
      toArray: async () => docs
    };
  }

  async findOne(): Promise<Record<string, unknown>> {
    return { _id: "1", name: "A", age: 3 };
  }

  async countDocuments(): Promise<number> {
    return 12;
  }

  async indexes(): Promise<Record<string, unknown>[]> {
    return [{ name: "_id_", unique: true, key: { _id: 1 } }];
  }

  async insertOne(document: Record<string, unknown>): Promise<{ insertedId: unknown }> {
    this.insertedDocuments.push(document);
    return { insertedId: document._id ?? "1" };
  }

  async deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
    this.deletedFilters.push(filter);
    return { deletedCount: 1 };
  }
}

class CapturingCollection extends FakeCollection {
  constructor(private readonly deletedCountByAttempt: number[]) {
    super();
  }

  override async deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
    this.deletedFilters.push(filter);
    return { deletedCount: this.deletedCountByAttempt.shift() ?? 0 };
  }
}

class CapturingMongoDb extends FakeMongoDb {
  constructor(
    databaseName: string,
    readonly collectionRef: CapturingCollection
  ) {
    super(databaseName);
  }

  override collection(): CollectionLike {
    return this.collectionRef;
  }
}

class CapturingMongoClient extends FakeMongoClient {
  constructor(private readonly collectionRef: CapturingCollection) {
    super();
  }

  override db(name = "app"): DbLike {
    return new CapturingMongoDb(name, this.collectionRef);
  }
}

describe("MongoDbAdapter", () => {
  it("uses full MongoDB connection strings as-is", async () => {
    const uris: string[] = [];
    const fullUri = "mongodb+srv://user:pass@example.mongodb.net/app?retryWrites=true";
    const adapter = new MongoDbAdapter((uri) => {
      uris.push(uri);
      return new FakeMongoClient();
    });

    await adapter.testConnection({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: fullUri,
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    expect(uris).toEqual([fullUri]);
  });

  it("does not append the default port when host already includes a port", async () => {
    const uris: string[] = [];
    const adapter = new MongoDbAdapter((uri) => {
      uris.push(uri);
      return new FakeMongoClient();
    });

    await adapter.testConnection({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "127.0.0.1:27018",
      port: 27017,
      username: "root",
      password: "secret",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    expect(uris[0]).toBe("mongodb://root:secret@127.0.0.1:27018");
  });

  it("falls back to authenticating against the selected database", async () => {
    const uris: string[] = [];
    class AuthFallbackClient extends FakeMongoClient {
      constructor(private readonly uri: string) {
        super();
      }

      override async connect(): Promise<MongoClientLike> {
        if (!this.uri.endsWith("/app")) {
          throw new Error("Authentication failed.");
        }
        return this;
      }
    }

    const adapter = new MongoDbAdapter((uri) => {
      uris.push(uri);
      return new AuthFallbackClient(uri);
    });

    const result = await adapter.testConnection({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      username: "app_user",
      password: "secret",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    expect(result.ok).toBe(true);
    expect(uris).toEqual([
      "mongodb://app_user:secret@localhost:27017",
      "mongodb://app_user:secret@localhost:27017/app"
    ]);
  });

  it("lists collections and inferred document fields", async () => {
    const adapter = new MongoDbAdapter(() => new FakeMongoClient());
    const session = await adapter.connect({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    await expect(adapter.listTables(session, "app")).resolves.toEqual([
      { name: "users", schema: "app", type: "base_table" }
    ]);
    const columns = await adapter.listColumns(session, { schema: "app", name: "users" });
    expect(columns.map((column) => column.name)).toEqual(["_id", "name", "age"]);
  });

  it("falls back to default database when listDatabases is not authorized", async () => {
    const adapter = new MongoDbAdapter(() => new NoListDatabasesClient());
    const session = await adapter.connect({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    await expect(adapter.listSchemas(session)).resolves.toEqual([]);
    await expect(adapter.listTables(session)).resolves.toEqual([
      { name: "users", schema: "app", type: "base_table" }
    ]);
  });

  it("translates generated table viewer SQL to find/count", async () => {
    const adapter = new MongoDbAdapter(() => new FakeMongoClient());
    const session = await adapter.connect({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    const page = await adapter.executeQuery(session, 'SELECT * FROM "app"."users" LIMIT 10 OFFSET 0');
    expect(page.rows).toEqual([{ _id: "1", name: "A" }]);

    const count = await adapter.executeQuery(session, 'SELECT COUNT(*) AS count FROM "app"."users"');
    expect(count.rows).toEqual([{ count: 12 }]);
  });

  it("translates generated table viewer DELETE to deleteOne", async () => {
    const collection = new CapturingCollection([1]);
    const adapter = new MongoDbAdapter(() => new CapturingMongoClient(collection));
    const session = await adapter.connect({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    const result = await adapter.executeQuery(
      session,
      'DELETE FROM "app"."users" WHERE "_id" = ?',
      { params: ["abc123"] }
    );

    expect(collection.deletedFilters).toEqual([{ _id: "abc123" }]);
    expect(result.affectedRows).toBe(1);
  });

  it("translates generated table viewer INSERT to insertOne for undo restore", async () => {
    const collection = new CapturingCollection([]);
    const adapter = new MongoDbAdapter(() => new CapturingMongoClient(collection));
    const session = await adapter.connect({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    const result = await adapter.executeQuery(
      session,
      'INSERT INTO "app"."users" ("_id", "name") VALUES (?, ?)',
      { params: ["507f1f77bcf86cd799439011", "A"] }
    );

    expect(collection.insertedDocuments).toHaveLength(1);
    expect(collection.insertedDocuments[0]._id).toBeInstanceOf(ObjectId);
    expect(collection.insertedDocuments[0].name).toBe("A");
    expect(result.affectedRows).toBe(1);
  });

  it("tries ObjectId then string fallback for 24-hex MongoDB _id deletes", async () => {
    const collection = new CapturingCollection([0, 1]);
    const adapter = new MongoDbAdapter(() => new CapturingMongoClient(collection));
    const session = await adapter.connect({
      id: "p1",
      name: "Mongo",
      dbType: "mongodb",
      host: "localhost",
      database: "app",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    const result = await adapter.executeQuery(
      session,
      'DELETE FROM "app"."users" WHERE "_id" = ?',
      { params: ["507f1f77bcf86cd799439011"] }
    );

    expect(collection.deletedFilters).toHaveLength(2);
    expect(collection.deletedFilters[0]._id).toBeInstanceOf(ObjectId);
    expect(collection.deletedFilters[1]).toEqual({ _id: "507f1f77bcf86cd799439011" });
    expect(result.affectedRows).toBe(1);
  });
});
