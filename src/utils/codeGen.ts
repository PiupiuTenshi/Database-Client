/**
 * Sinh code từ schema bảng: TypeScript interface, C# entity và CRUD SQL.
 * Thuần, không I/O. Map kiểu dữ liệu theo heuristic chung cho mọi engine.
 */
import type { ColumnInfo, ObjectRef } from "../core/types";

export type CodeTarget = "typescript" | "csharp" | "crud";

function pascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function tsType(dataType: string): string {
  const t = dataType.toLowerCase();
  if (/int|serial|decimal|numeric|float|double|real|money/.test(t)) return "number";
  if (/bool|bit/.test(t)) return "boolean";
  if (/json/.test(t)) return "unknown";
  return "string";
}

function csharpType(dataType: string, nullable: boolean): string {
  const t = dataType.toLowerCase();
  let base = "string";
  if (/bigint/.test(t)) base = "long";
  else if (/int|serial|smallint|tinyint/.test(t)) base = "int";
  else if (/decimal|numeric|money/.test(t)) base = "decimal";
  else if (/float|double|real/.test(t)) base = "double";
  else if (/bool|bit/.test(t)) base = "bool";
  else if (/timestamp|datetime|date/.test(t)) base = "DateTime";
  else if (/uuid|uniqueidentifier/.test(t)) base = "Guid";
  const isValueType = base !== "string";
  return nullable && isValueType ? `${base}?` : base;
}

export function generateTypeScript(ref: ObjectRef, columns: ColumnInfo[]): string {
  const name = pascalCase(ref.name);
  const fields = columns
    .map((column) => {
      const optional = column.nullable ? "?" : "";
      const type = column.nullable ? `${tsType(column.dataType)} | null` : tsType(column.dataType);
      return `  ${column.name}${optional}: ${type};`;
    })
    .join("\n");
  return `export interface ${name} {\n${fields}\n}\n`;
}

export function generateCSharp(ref: ObjectRef, columns: ColumnInfo[]): string {
  const name = pascalCase(ref.name);
  const props = columns
    .map(
      (column) =>
        `    public ${csharpType(column.dataType, column.nullable)} ${pascalCase(column.name)} { get; set; }`
    )
    .join("\n");
  return `public class ${name}\n{\n${props}\n}\n`;
}

export function generateCrud(
  ref: ObjectRef,
  columns: ColumnInfo[],
  quote: (id: string) => string
): string {
  const target = ref.schema ? `${quote(ref.schema)}.${quote(ref.name)}` : quote(ref.name);
  const cols = columns.map((column) => quote(column.name));
  const pk = columns.filter((column) => column.isPrimaryKey);
  const keyCols = (pk.length > 0 ? pk : columns.slice(0, 1)).map((column) => column.name);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const whereKey = keyCols.map((column, index) => `${quote(column)} = $${index + 1}`).join(" AND ");
  const setList = columns
    .map((column, index) => `${quote(column.name)} = $${index + 1}`)
    .join(", ");

  return [
    `-- SELECT`,
    `SELECT ${cols.join(", ")} FROM ${target} WHERE ${whereKey};`,
    ``,
    `-- INSERT`,
    `INSERT INTO ${target} (${cols.join(", ")}) VALUES (${placeholders});`,
    ``,
    `-- UPDATE`,
    `UPDATE ${target} SET ${setList} WHERE ${whereKey};`,
    ``,
    `-- DELETE`,
    `DELETE FROM ${target} WHERE ${whereKey};`,
    ``
  ].join("\n");
}

export function generateCode(
  target: CodeTarget,
  ref: ObjectRef,
  columns: ColumnInfo[],
  quote: (id: string) => string
): { content: string; language: string } {
  switch (target) {
    case "typescript":
      return { content: generateTypeScript(ref, columns), language: "typescript" };
    case "csharp":
      return { content: generateCSharp(ref, columns), language: "csharp" };
    case "crud":
      return { content: generateCrud(ref, columns, quote), language: "sql" };
  }
}
