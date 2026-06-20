import type { ConnectionProfile, ObjectRef } from "../core/types";
import { generateCode, type CodeTarget } from "../utils/codeGen";
import { generateRows, type MockOptions } from "../utils/mockData";
import type { DataEditService } from "./DataEditService";
import type { SchemaService } from "./SchemaService";
import type { SessionManager } from "./SessionManager";

export interface MockInsertResult {
  inserted: number;
  errors: { row: number; message: string }[];
}

/** Cap số dòng mock data trong một lần để tránh treo extension host. */
const MOCK_ROW_CAP = 5_000;

/** Sinh mock data (insert) và sinh code (TS/C#/CRUD) từ schema bảng. */
export class GeneratorService {
  constructor(
    private readonly schemaService: SchemaService,
    private readonly dataEditService: DataEditService,
    private readonly sessionManager: SessionManager
  ) {}

  /** Sinh và insert mock data; lỗi từng dòng được gom lại, không chặn các dòng còn lại. */
  async generateMockData(
    profile: ConnectionProfile,
    ref: ObjectRef,
    options: MockOptions
  ): Promise<MockInsertResult> {
    const columns = await this.schemaService.listColumns(profile, ref);
    const count = Math.min(options.count, MOCK_ROW_CAP);
    const rows = generateRows(
      columns.map((column) => ({
        name: column.name,
        dataType: column.dataType,
        nullable: column.nullable,
        isPrimaryKey: column.isPrimaryKey
      })),
      { ...options, count }
    );
    const result: MockInsertResult = { inserted: 0, errors: [] };
    for (let r = 0; r < rows.length; r++) {
      try {
        await this.dataEditService.insertRow(profile, ref, rows[r]);
        result.inserted += 1;
      } catch (error) {
        result.errors.push({
          row: r + 1,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return result;
  }

  /** Sinh code từ schema bảng cho target chỉ định. */
  async generateCode(
    profile: ConnectionProfile,
    ref: ObjectRef,
    target: CodeTarget
  ): Promise<{ content: string; language: string }> {
    const [columns, { adapter }] = await Promise.all([
      this.schemaService.listColumns(profile, ref),
      this.sessionManager.getOrConnect(profile)
    ]);
    return generateCode(target, ref, columns, (id) => adapter.quoteIdentifier(id));
  }
}
