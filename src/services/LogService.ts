import * as vscode from "vscode";
import { EXTENSION_DISPLAY_NAME } from "../core/constants";

/**
 * Ghi log ra Output channel. Người gọi có trách nhiệm mask secret (utils/maskSecret)
 * trước khi truyền chuỗi vào đây — service này không tự biết trường nào nhạy cảm.
 */
export class LogService implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;

  constructor() {
    this.channel = vscode.window.createOutputChannel(EXTENSION_DISPLAY_NAME);
  }

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  error(message: string): void {
    this.channel.appendLine(`[error] ${message}`);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
