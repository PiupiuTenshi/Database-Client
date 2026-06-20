import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import { getHelloWorldMessage } from "../core/messages";

export function registerCommands(context: vscode.ExtensionContext): void {
  const helloWorld = vscode.commands.registerCommand(COMMANDS.helloWorld, () => {
    void vscode.window.showInformationMessage(getHelloWorldMessage());
  });

  context.subscriptions.push(helloWorld);
}
