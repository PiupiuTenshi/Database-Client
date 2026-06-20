import * as vscode from "vscode";
import { registerCommands } from "./commands/registerCommands";
import { EXTENSION_DISPLAY_NAME } from "./core/constants";

export function activate(context: vscode.ExtensionContext): void {
  registerCommands(context);
  console.log(`${EXTENSION_DISPLAY_NAME} activated.`);
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions from the extension context.
}
