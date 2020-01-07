import { languages, ExtensionContext } from "vscode";
import { importCompletionProvider } from "./ImportCompletionProvider";

export function activate(context: ExtensionContext) {
  console.log('"vscode-import-autocomplete" extension is now active!');

  const triggerCharacters = [
    '"',
    "'",
    "/",
    "-",
    "_",
    "@",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0"
  ];
  const selector = [
    "typescript",
    "javascript",
    "javascriptreact",
    "typescriptreact"
  ];
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      selector,
      importCompletionProvider,
      ...triggerCharacters
    )
  );
}

export function deactivate() {
  console.log('"vscode-import-autocomplete" extension is deactivated.');
}
