import { quoteStringLiteral } from "../../utils/sqlSafety";

/**
 * SQL introspection cho SQL Server. mssql request.query không nhận placeholder
 * kiểu $1/?, nên ta nhúng giá trị bằng string literal đã escape (quoteStringLiteral).
 */

export const LIST_SCHEMAS = `
SELECT name AS name
FROM sys.schemas
WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
  AND name NOT LIKE 'db[_]%'
ORDER BY name`;

export function listTablesSql(schema: string): string {
  return `
SELECT TABLE_NAME AS name
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ${quoteStringLiteral(schema)}
ORDER BY TABLE_NAME`;
}

export function listViewsSql(schema: string): string {
  return `
SELECT TABLE_NAME AS name
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'VIEW' AND TABLE_SCHEMA = ${quoteStringLiteral(schema)}
ORDER BY TABLE_NAME`;
}

export function listColumnsSql(schema: string, table: string): string {
  return `
SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, ORDINAL_POSITION AS ordinal_position,
       IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = ${quoteStringLiteral(schema)} AND TABLE_NAME = ${quoteStringLiteral(table)}
ORDER BY ORDINAL_POSITION`;
}

export function listPrimaryKeysSql(schema: string, table: string): string {
  return `
SELECT kcu.COLUMN_NAME AS column_name
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_SCHEMA = ${quoteStringLiteral(schema)} AND tc.TABLE_NAME = ${quoteStringLiteral(table)}`;
}

export function listIndexesSql(schema: string, table: string): string {
  const objectId = quoteStringLiteral(`${schema}.${table}`);
  return `
SELECT i.name AS index_name, i.is_unique AS is_unique, c.name AS column_name, ic.key_ordinal AS key_ordinal
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(${objectId}) AND i.name IS NOT NULL
ORDER BY i.name, ic.key_ordinal`;
}

export function listForeignKeysSql(schema: string, table: string): string {
  const objectId = quoteStringLiteral(`${schema}.${table}`);
  return `
SELECT fk.name AS constraint_name,
       pc.name AS source_column,
       OBJECT_NAME(fkc.referenced_object_id) AS target_table,
       rc.name AS target_column,
       fk.update_referential_action_desc AS update_rule,
       fk.delete_referential_action_desc AS delete_rule
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
WHERE fkc.parent_object_id = OBJECT_ID(${objectId})
ORDER BY fk.name, fkc.constraint_column_id`;
}

export function listViewDependenciesSql(schema: string, view: string): string {
  return `
SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name
FROM INFORMATION_SCHEMA.VIEW_TABLE_USAGE
WHERE VIEW_SCHEMA = ${quoteStringLiteral(schema)} AND VIEW_NAME = ${quoteStringLiteral(view)}
ORDER BY TABLE_SCHEMA, TABLE_NAME`;
}

export function listTriggersSql(schema: string, table: string): string {
  const objectId = quoteStringLiteral(`${schema}.${table}`);
  return `
SELECT t.name AS trigger_name,
       CASE WHEN OBJECTPROPERTY(t.object_id, 'ExecIsInsteadOfTrigger') = 1 THEN 'INSTEAD OF' ELSE 'AFTER' END AS action_timing,
       LTRIM(STUFF(
         CASE WHEN OBJECTPROPERTY(t.object_id, 'ExecIsInsertTrigger') = 1 THEN ', INSERT' ELSE '' END +
         CASE WHEN OBJECTPROPERTY(t.object_id, 'ExecIsUpdateTrigger') = 1 THEN ', UPDATE' ELSE '' END +
         CASE WHEN OBJECTPROPERTY(t.object_id, 'ExecIsDeleteTrigger') = 1 THEN ', DELETE' ELSE '' END,
         1, 2, '')) AS event_manipulation,
       OBJECT_DEFINITION(t.object_id) AS action_statement
FROM sys.triggers t
WHERE t.parent_id = OBJECT_ID(${objectId})
ORDER BY t.name`;
}

export function listChecksSql(schema: string, table: string): string {
  const objectId = quoteStringLiteral(`${schema}.${table}`);
  return `
SELECT cc.name AS constraint_name, cc.definition AS check_clause
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(${objectId})
ORDER BY cc.name`;
}

export function objectDefinitionSql(schema: string, table: string): string {
  return `SELECT OBJECT_DEFINITION(OBJECT_ID(${quoteStringLiteral(`${schema}.${table}`)})) AS def`;
}
