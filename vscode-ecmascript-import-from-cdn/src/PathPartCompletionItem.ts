import { CompletionItem, CompletionItemKind, TextEdit, Range } from "vscode";
import { CompletionState } from "./ImportCompletionProvider";

export class PathPartCompletionItem extends CompletionItem {
  constructor({
    label,
    kind,
    replacementStartIndex,
    state,
    sortText
  }: {
    label: string;
    kind: CompletionItemKind;
    replacementStartIndex?: number;
    state?: CompletionState;
    sortText?: string;
  }) {
    super(label, kind);

    if (sortText) this.sortText = sortText;

    if (replacementStartIndex !== undefined && state !== undefined) {
      const { cursorLine, cursorCharacter } = state;
      this.textEdit = TextEdit.replace(
        new Range(
          cursorLine,
          replacementStartIndex,
          cursorLine,
          cursorCharacter
        ),
        label
      );
    }
  }
}
