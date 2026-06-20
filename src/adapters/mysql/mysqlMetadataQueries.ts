/** SQL introspection cho MySQL/MariaDB. Dùng chung cho adapter + test. */

export const LIST_SCHEMAS = `
SELECT schema_name AS schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
ORDER BY schema_name`;

export const LIST_TABLES = `
SELECT table_name AS table_name
FROM information_schema.tables
WHERE table_schema = ? AND table_type = 'BASE TABLE'
ORDER BY table_name`;

export const LIST_VIEWS = `
SELECT table_name AS table_name
FROM information_schema.tables
WHERE table_schema = ? AND table_type = 'VIEW'
ORDER BY table_name`;

export const LIST_COLUMNS = `
SELECT column_name AS column_name, data_type AS data_type, ordinal_position AS ordinal_position,
       is_nullable AS is_nullable, column_default AS column_default, column_key AS column_key
FROM information_schema.columns
WHERE table_schema = ? AND table_name = ?
ORDER BY ordinal_position`;

export const LIST_INDEXES = `
SELECT index_name AS index_name, non_unique AS non_unique, column_name AS column_name,
       seq_in_index AS seq_in_index
FROM information_schema.statistics
WHERE table_schema = ? AND table_name = ?
ORDER BY index_name, seq_in_index`;

export const LIST_FOREIGN_KEYS = `
SELECT kcu.constraint_name AS constraint_name,
       kcu.column_name AS source_column,
       kcu.referenced_table_name AS target_table,
       kcu.referenced_column_name AS target_column,
       rc.update_rule AS update_rule,
       rc.delete_rule AS delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
WHERE kcu.table_schema = ? AND kcu.table_name = ? AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.constraint_name, kcu.ordinal_position`;
