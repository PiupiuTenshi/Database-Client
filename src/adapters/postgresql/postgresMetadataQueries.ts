/** SQL introspection cho PostgreSQL. Tách riêng để adapter và test dùng chung. */

export const LIST_SCHEMAS = `
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema')
  AND schema_name NOT LIKE 'pg\\_%'
ORDER BY schema_name`;

export const LIST_TABLES = `
SELECT table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema = $1
ORDER BY table_name`;

export const LIST_VIEWS = `
SELECT table_name
FROM information_schema.tables
WHERE table_type = 'VIEW' AND table_schema = $1
ORDER BY table_name`;

export const LIST_COLUMNS = `
SELECT column_name, data_type, ordinal_position, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position`;

export const LIST_PRIMARY_KEYS = `
SELECT kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2`;

export const LIST_INDEXES = `
SELECT i.relname AS index_name, ix.indisunique AS is_unique, a.attname AS column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = $2 AND n.nspname = $1
ORDER BY i.relname, a.attnum`;

export const LIST_FOREIGN_KEYS = `
SELECT tc.constraint_name,
       kcu.column_name AS source_column,
       ccu.table_name AS target_table,
       ccu.column_name AS target_column,
       rc.update_rule,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2`;

export const REL_KIND = `
SELECT c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2`;

export const VIEW_DEF = `SELECT pg_get_viewdef(format('%I.%I', $1, $2)::regclass, true) AS def`;
