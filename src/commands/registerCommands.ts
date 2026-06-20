import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import { getHelloWorldMessage } from "../core/messages";
import { registerConnectionCommands, type CommandDeps } from "./connectionCommands";
import { registerSchemaCommands } from "./schemaCommands";

export function registerCommands(context: vscode.ExtensionContext, deps: CommandDeps): void {
  const helloWorld = vscode.commands.registerCommand(COMMANDS.helloWorld, () => {
    void vscode.window.showInformationMessage(getHelloWorldMessage());
  });
  context.subscriptions.push(helloWorld);

  registerConnectionCommands(context, deps);
  registerSchemaCommands(context, deps.queryService);
}
