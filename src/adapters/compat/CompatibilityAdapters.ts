import type { DbType } from "../../core/types";
import { MySqlAdapter, type MySqlClientFactory } from "../mysql/MySqlAdapter";
import { PostgresAdapter, type PgClientFactory } from "../postgresql/PostgresAdapter";
import { SqlServerAdapter, type MssqlClientFactory } from "../sqlserver/SqlServerAdapter";

export class AzureSqlAdapter extends SqlServerAdapter {
  override readonly dbType: DbType = "azuresql";

  constructor(factory?: MssqlClientFactory) {
    super(factory);
  }
}

export class CockroachDbAdapter extends PostgresAdapter {
  override readonly dbType: DbType = "cockroachdb";

  constructor(factory?: PgClientFactory) {
    super(factory);
  }
}

export class GaussDbAdapter extends PostgresAdapter {
  override readonly dbType: DbType = "gaussdb";

  constructor(factory?: PgClientFactory) {
    super(factory);
  }
}

export class KingbaseAdapter extends PostgresAdapter {
  override readonly dbType: DbType = "kingbase";

  constructor(factory?: PgClientFactory) {
    super(factory);
  }
}

export class RedshiftAdapter extends PostgresAdapter {
  override readonly dbType: DbType = "redshift";

  constructor(factory?: PgClientFactory) {
    super(factory);
  }
}

export class DorisAdapter extends MySqlAdapter {
  constructor(factory?: MySqlClientFactory) {
    super("doris", factory);
  }
}
