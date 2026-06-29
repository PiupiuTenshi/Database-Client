import { AdapterRegistry } from "./AdapterRegistry";
import {
  AzureSqlAdapter,
  CockroachDbAdapter,
  DorisAdapter,
  GaussDbAdapter,
  KingbaseAdapter,
  RedshiftAdapter
} from "./compat/CompatibilityAdapters";
import { DuckDbAdapter } from "./duckdb/DuckDbAdapter";
import {
  ClickHouseAdapter,
  CloudflareD1Adapter,
  PrestoAdapter,
  TrinoAdapter,
  TursoAdapter
} from "./httpSql/HttpSqlAdapter";
import { MongoDbAdapter } from "./mongodb/MongoDbAdapter";
import { MySqlAdapter } from "./mysql/MySqlAdapter";
import { OracleAdapter } from "./oracle/OracleAdapter";
import { PostgresAdapter } from "./postgresql/PostgresAdapter";
import { RedisAdapter } from "./redis/RedisAdapter";
import { SqlServerAdapter } from "./sqlserver/SqlServerAdapter";
import { SqliteAdapter } from "./sqlite/SqliteAdapter";

export function registerDefaultAdapters(registry: AdapterRegistry): void {
  registry.register(new SqliteAdapter());
  registry.register(new PostgresAdapter());
  registry.register(new MySqlAdapter("mysql"));
  registry.register(new MySqlAdapter("mariadb"));
  registry.register(new SqlServerAdapter());
  registry.register(new DuckDbAdapter());
  registry.register(new MongoDbAdapter());
  registry.register(new OracleAdapter());
  registry.register(new CloudflareD1Adapter());
  registry.register(new TursoAdapter());
  registry.register(new AzureSqlAdapter());
  registry.register(new CockroachDbAdapter());
  registry.register(new GaussDbAdapter());
  registry.register(new KingbaseAdapter());
  registry.register(new RedshiftAdapter());
  registry.register(new DorisAdapter());
  registry.register(new ClickHouseAdapter());
  registry.register(new TrinoAdapter());
  registry.register(new PrestoAdapter());
  registry.register(new RedisAdapter());
}
