import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { UpdateService } from "../services/UpdateService";

export interface UpdateCommandDeps {
  updateService: UpdateService;
}

export function registerUpdateCommands(
  context: vscode.ExtensionContext,
  deps: UpdateCommandDeps
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.checkForUpdates, async () => {
      await deps.updateService.checkForUpdates({ force: true });
    })
  );
}
