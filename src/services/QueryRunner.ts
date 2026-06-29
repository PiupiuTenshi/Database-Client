import * as vscode from "vscode";
import { normalizeError } from "../adapters/common/normalizeError";
import type { ConnectionProfile, QueryResult } from "../core/types";
import { newId } from "../utils/objectId";
import { analyzeStatements } from "../utils/sqlAnalyzer";
import { splitStatements } from "../utils/statementSplitter";
import type { QueryHistoryStore } from "../storage/QueryHistoryStore";
import { ResultGridPanel } from "../webviews/queryResult/ResultGridPanel";
import type { Logger } from "./ConnectionService";
import type { QueryService } from "./QueryService";

/** Điều phối chạy SQL: progress + cancel + result grid + lưu history. */
export class QueryRunner {
  constructor(
    private readonly queryService: QueryService,
    private readonly historyStore: QueryHistoryStore,
    private readonly logger: Logger,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  /** Chạy 1 hoặc nhiều statement trong sqlText; hiển thị kết quả của statement cuối. */
  async run(profile: ConnectionProfile, sqlText: string): Promise<void> {
    const statements = splitStatements(sqlText).map((statement) => statement.text);
    if (statements.length === 0) {
      void vscode.window.showInformationMessage("No SQL statement to run.");
      return;
    }

    const warnings = analyzeStatements(statements);
    if (warnings.length > 0) {
      const detail = warnings.map((warning) => `• ${warning.reason}`).join("\n");
      const choice = await vscode.window.showWarningMessage(
        `This query contains ${warnings.length} potentially destructive statement(s):\n\n${detail}`,
        { modal: true },
        "Run anyway"
      );
      if (choice !== "Run anyway") {
        return;
      }
    }

    const maxRows = vscode.workspace
      .getConfiguration("openDbNexus")
      .get<number>("query.maxRows", 1000);
    const controller = new AbortController();
    const started = Date.now();
    let runningStatement = statements[0];

    try {
      const last = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: true,
          title: `Running query on ${profile.name}…`
        },
        async (_progress, token) => {
          token.onCancellationRequested(() => controller.abort());
          let result: QueryResult | undefined;
          for (const statement of statements) {
            runningStatement = statement;
            result = await this.queryService.execute(profile, statement, {
              maxRows,
              signal: controller.signal
            });
          }
          return result;
        }
      );

      if (last) {
        ResultGridPanel.showResult(last);
        await this.record(profile, sqlText, "success", {
          durationMs: last.durationMs,
          rowCount: last.rowCount
        });
      }
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const dbError = normalizeError(error);
      this.logger.error(`Query failed on "${profile.name}": ${dbError.message}`);
      ResultGridPanel.showError(dbError, Date.now() - started, { sql: runningStatement });
      await this.record(profile, sqlText, cancelled ? "cancelled" : "error", {
        errorMessage: dbError.message
      });
    }
  }

  private async record(
    profile: ConnectionProfile,
    sql: string,
    status: "success" | "error" | "cancelled",
    extra: { durationMs?: number; rowCount?: number; errorMessage?: string }
  ): Promise<void> {
    await this.historyStore.add({
      id: newId(),
      connectionId: profile.id,
      connectionName: profile.name,
      sql: sql.trim(),
      status,
      createdAt: this.now(),
      ...extra
    });
  }
}
