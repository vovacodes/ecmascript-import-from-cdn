import * as assert from "assert";
import * as vscode from "vscode";
import { importCompletionProvider } from "../../ImportCompletionProvider";

// See the link below for insiparation
// https://github.com/microsoft/vscode/blob/693ffb4d5746d98973c90302d6eaab0552e16936/extensions/typescript-language-features/src/test/suggestTestHelpers.ts

suite("ImportCompletionProvider", () => {
  test("Provide suggeestions for every segment of the path", async () => {
    let suggestedItem: vscode.CompletionItem | undefined;
    const restore = tapIntoResolveCompletionItem(item => {
      suggestedItem = item;
    });

    const doc = await vscode.workspace.openTextDocument({
      language: "typescript"
    });
    const editor = await vscode.window.showTextDocument(
      doc,
      vscode.ViewColumn.One
    );

    // Suggest CDN URL prefix
    await vscode.commands.executeCommand("type", { text: "import '" });
    await vscode.commands.executeCommand("editor.action.triggerSuggest");
    await sleep(2000);
    assert.equal(suggestedItem?.label, "https://unpkg.com/");
    await vscode.commands.executeCommand("acceptSelectedSuggestion");
    assert.equal(editor.document.lineAt(0).text, "import 'https://unpkg.com/'");

    // Suggest package name
    await vscode.commands.executeCommand("type", { text: "react" });
    await vscode.commands.executeCommand("editor.action.triggerSuggest");
    await sleep(2000);
    assert.equal(suggestedItem?.label, "react");
    await vscode.commands.executeCommand("acceptSelectedSuggestion");
    assert.equal(
      editor.document.lineAt(0).text,
      "import 'https://unpkg.com/react'"
    );

    // Suggest version
    await vscode.commands.executeCommand("type", { text: "@15." });
    await vscode.commands.executeCommand("editor.action.triggerSuggest");
    await sleep(5000);
    assert.equal(suggestedItem?.label, "15.6.2");
    await vscode.commands.executeCommand("acceptSelectedSuggestion");
    assert.equal(
      editor.document.lineAt(0).text,
      "import 'https://unpkg.com/react@15.6.2'"
    );

    // Suggest file
    await vscode.commands.executeCommand("type", { text: "/dis" });
    await vscode.commands.executeCommand("editor.action.triggerSuggest");
    await sleep(3000);
    await vscode.commands.executeCommand("selectNextSuggestion"); // scroll to the 2nd suggestion
    await vscode.commands.executeCommand("selectNextSuggestion"); // scroll to the 3rd suggestion
    assert.equal(suggestedItem?.label, "/dist/react.js");
    await vscode.commands.executeCommand("acceptSelectedSuggestion");
    assert.equal(
      editor.document.lineAt(0).text,
      "import 'https://unpkg.com/react@15.6.2/dist/react.js'"
    );

    restore();
  });
});

function tapIntoResolveCompletionItem(
  onReolveCompletionItem: (item: vscode.CompletionItem) => void
): () => void {
  const originalResolveCompletionItem =
    importCompletionProvider.resolveCompletionItem;

  importCompletionProvider.resolveCompletionItem = async function(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ) {
    onReolveCompletionItem(item);

    if (originalResolveCompletionItem) {
      return originalResolveCompletionItem.call(this, item, token);
    }

    return item;
  };

  return function restore() {
    importCompletionProvider.resolveCompletionItem = originalResolveCompletionItem;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
