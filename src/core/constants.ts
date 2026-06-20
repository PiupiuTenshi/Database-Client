import type { ConnectionEnvironment, DbType } from "./types";

export const EXTENSION_DISPLAY_NAME = "Open DB Nexus";

/** View container ở Activity Bar. Trùng với contributes.viewsContainers trong package.json. */
export const VIEW_CONTAINER_ID = "openDbNexus";

/** Id các TreeView. Trùng với contributes.views trong package.json. */
export const VIEWS = {
  connections: "openDbNexus.connections"
} as const;

/** Command id theo namespace openDbNexus.*. Trùng với contributes.commands. */
export const COMMANDS = {
  helloWorld: "openDbNexus.helloWorld",
  addConnection: "openDbNexus.addConnection",
  editConnection: "openDbNexus.editConnection",
  deleteConnection: "openDbNexus.deleteConnection",
  testConnection: "openDbNexus.testConnection",
  refreshConnections: "openDbNexus.refreshConnections",
  openDashboard: "openDbNexus.openDashboard",
  backupConnection: "openDbNexus.backupConnection",
  openTableData: "openDbNexus.openTableData",
  generateCode: "openDbNexus.generateCode",
  generateMockData: "openDbNexus.generateMockData",
  openDependencyGraph: "openDbNexus.openDependencyGraph",
  openDependencyReport: "openDbNexus.openDependencyReport",
  openQuery: "openDbNexus.openQuery",
  runQuery: "openDbNexus.runQuery",
  runAllQueries: "openDbNexus.runAllQueries",
  changeQueryConnection: "openDbNexus.changeQueryConnection",
  showQueryHistory: "openDbNexus.showQueryHistory"
} as const;

/** contextValue gắn lên TreeItem để điều khiển hiển thị context menu (when: viewItem == ...). */
export const CONTEXT_VALUES = {
  connection: "connection",
  table: "table",
  info: "info"
} as const;

/** Lựa chọn DB type hiển thị trong form. fileBased = DB dạng file (cần filePath). */
export const DB_TYPE_OPTIONS: { value: DbType; label: string; fileBased: boolean }[] = [
  { value: "sqlite", label: "SQLite", fileBased: true },
  { value: "postgresql", label: "PostgreSQL", fileBased: false },
  { value: "mysql", label: "MySQL", fileBased: false },
  { value: "mariadb", label: "MariaDB", fileBased: false },
  { value: "sqlserver", label: "SQL Server", fileBased: false },
  { value: "duckdb", label: "DuckDB", fileBased: true },
  { value: "mongodb", label: "MongoDB", fileBased: false },
  { value: "redis", label: "Redis", fileBased: false },
  { value: "oracle", label: "Oracle", fileBased: false }
];

export const ENVIRONMENT_OPTIONS: ConnectionEnvironment[] = [
  "local",
  "dev",
  "staging",
  "production"
];

export function isFileBasedDb(dbType: DbType): boolean {
  return DB_TYPE_OPTIONS.find((option) => option.value === dbType)?.fileBased ?? false;
}
