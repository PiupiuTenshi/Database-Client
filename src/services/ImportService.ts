import type { ConnectionProfile, ObjectRef } from "../core/types";
import { parseCsv } from "../utils/csv";
import type { ColumnValue } from "../utils/rowMutation";
import type { DataEditService } from "./DataEditService";

export interface ImportPlan {
  /** Header CSV → tên cột DB (đã auto-map theo tên, không phân biệt hoa thường). */
  mapping: { csvHeader: string; column: string | null }[];
  rowCount: number;
}

export interface ImportResult {
  inserted: number;
  errors: { row: number; message: string }[];
}

/** Trần số dòng import trong một lần để tránh treo extension host. */
const IMPORT_ROW_CAP = 10_000;

/**
 * Import CSV vào một bảng. Auto-map header CSV với cột DB theo tên; ô rỗng được
 * coi là NULL. Mỗi dòng là một INSERT parameterized; lỗi từng dòng được gom lại
 * và không chặn các dòng còn lại.
 */
export class ImportService {
  constructor(private readonly dataEditService: DataEditService) {}

  /** Phân tích CSV và auto-map với danh sách cột của bảng. */
  plan(
    csvText: string,
    tableColumns: string[]
  ): { headers: string[]; rows: string[][] } & ImportPlan {
    const { headers, rows } = parseCsv(csvText);
    const lookup = new Map(tableColumns.map((c) => [c.toLowerCase(), c]));
    const mapping = headers.map((csvHeader) => ({
      csvHeader,
      column: lookup.get(csvHeader.trim().toLowerCase()) ?? null
    }));
    return { headers, rows, mapping, rowCount: rows.length };
  }

  async run(
    profile: ConnectionProfile,
    ref: ObjectRef,
    headers: string[],
    rows: string[][],
    mapping: { csvHeader: string; column: string | null }[]
  ): Promise<ImportResult> {
    const targets = mapping
      .map((m, index) => ({ index, column: m.column }))
      .filter((m): m is { index: number; column: string } => m.column !== null);
    if (targets.length === 0) {
      throw new Error("No CSV columns could be mapped to table columns.");
    }
    const result: ImportResult = { inserted: 0, errors: [] };
    const limit = Math.min(rows.length, IMPORT_ROW_CAP);
    for (let r = 0; r < limit; r++) {
      const row = rows[r];
      const values: ColumnValue[] = targets
        .map((t) => ({ column: t.column, value: row[t.index] === "" ? null : row[t.index] }))
        .filter((v) => v.value !== null);
      if (values.length === 0) {
        continue;
      }
      try {
        await this.dataEditService.insertRow(profile, ref, values);
        result.inserted += 1;
      } catch (error) {
        result.errors.push({
          row: r + 2, // +1 cho 0-index, +1 cho dòng header
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    if (rows.length > IMPORT_ROW_CAP) {
      result.errors.push({
        row: IMPORT_ROW_CAP + 2,
        message: `Import capped at ${IMPORT_ROW_CAP} rows; ${rows.length - IMPORT_ROW_CAP} row(s) skipped.`
      });
    }
    return result;
  }
}
