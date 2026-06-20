import type { DbType } from "../core/types";
import type { DatabaseAdapter } from "./DatabaseAdapter";

/** Sổ đăng ký adapter theo DbType. */
export class AdapterRegistry {
  private readonly adapters = new Map<DbType, DatabaseAdapter>();

  register(adapter: DatabaseAdapter): void {
    this.adapters.set(adapter.dbType, adapter);
  }

  get(dbType: DbType): DatabaseAdapter | undefined {
    return this.adapters.get(dbType);
  }

  has(dbType: DbType): boolean {
    return this.adapters.has(dbType);
  }
}
