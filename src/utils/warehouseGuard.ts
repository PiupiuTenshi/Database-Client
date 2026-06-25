import type { ConnectionProfile } from "../core/types";

const WAREHOUSE_TYPES = new Set([
  "clickhouse",
  "trino",
  "presto",
  "redshift",
  "doris"
]);

export interface WarehouseQueryWarning {
  code: "warehouse-no-limit" | "warehouse-full-scan";
  message: string;
}

export function isWarehouseConnection(profile: ConnectionProfile): boolean {
  return WAREHOUSE_TYPES.has(profile.dbType);
}

export function getWarehouseQueryWarnings(
  profile: ConnectionProfile,
  sql: string
): WarehouseQueryWarning[] {
  if (!isWarehouseConnection(profile)) {
    return [];
  }
  const normalized = stripCommentsAndStrings(sql).toLowerCase();
  if (!/\bselect\b/.test(normalized)) {
    return [];
  }
  const warnings: WarehouseQueryWarning[] = [];
  if (!/\blimit\s+\d+\b/.test(normalized) && !/\bfetch\s+next\s+\d+\s+rows\b/.test(normalized)) {
    warnings.push({
      code: "warehouse-no-limit",
      message: "Warehouse query has no LIMIT/FETCH cap."
    });
  }
  if (/\bfrom\s+[\w".`-]+(?:\s|;|$)/.test(normalized) && !/\bwhere\b/.test(normalized)) {
    warnings.push({
      code: "warehouse-full-scan",
      message: "Warehouse query may scan a full table."
    });
  }
  return warnings;
}

function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'([^']|'')*'/g, "''")
    .replace(/"([^"]|"")*"/g, '""');
}
