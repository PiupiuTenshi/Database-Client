import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import { getHelloWorldMessage } from "../core/messages";
import { registerConnectionCommands, type CommandDeps } from "./connectionCommands";
import { registerQueryCommands, type QueryCommandDeps } from "./queryCommands";
import { registerSchemaCommands } from "./schemaCommands";

export type AllCommandDeps = CommandDeps & QueryCommandDeps;

export function registerCommands(context: vscode.ExtensionContext, deps: AllCommandDeps): void {
  const helloWorld = vscode.commands.registerCommand(COMMANDS.helloWorld, () => {
    void vscode.window.showInformationMessage(getHelloWorldMessage());
  });
  context.subscriptions.push(helloWorld);

  registerConnectionCommands(context, deps);
  registerSchemaCommands(context, deps.queryService);
  registerQueryCommands(context, deps);
}
