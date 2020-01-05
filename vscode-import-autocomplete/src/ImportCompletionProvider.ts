/**
 * Some code is borrowed from https://github.com/ChristianKohler/NpmIntellisense
 */
import {
  CompletionItemProvider,
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionList,
  CompletionItemKind
} from "vscode";
import { searchPackageNames } from "./searchPackageNames";
import { parseModulePathParts, UNPKG_URL_PREFIX } from "./parseModulePathParts";
import { getVersionsAndTags, getFilePaths } from "./packageUtils";
import { PathPartCompletionItem } from "./PathPartCompletionItem";

export type CompletionState = {
  currentLineText: string;
  cursorCharacter: number;
  cursorLine: number;
};

export class ImportCompletionProvider implements CompletionItemProvider {
  public async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList> {
    const completionState = {
      currentLineText: document.lineAt(position).text,
      cursorCharacter: position.character,
      cursorLine: position.line
    };

    if (!this.shouldProvide(completionState)) {
      return [];
    }

    return this.provide(completionState);
  }

  shouldProvide(state: CompletionState) {
    return (
      isImport(state.currentLineText, state.cursorCharacter) &&
      !isLocalModuleImport(state.currentLineText, state.cursorCharacter)
    );
  }

  async provide(
    state: CompletionState
  ): Promise<CompletionItem[] | CompletionList> {
    const { currentLineText, cursorCharacter } = state;
    const parts = parseModulePathParts(currentLineText, cursorCharacter);
    if (parts === undefined) {
      return new CompletionList(
        [
          new PathPartCompletionItem({
            label: UNPKG_URL_PREFIX,
            kind: CompletionItemKind.Folder
          })
        ],
        true
      );
    }

    const { urlPrefix, packageName, version, filePath } = parts;
    if (urlPrefix.text !== UNPKG_URL_PREFIX) {
      // If import string doesn't contains UNPKG URL prefix, suggest it
      return new CompletionList(
        [
          new PathPartCompletionItem({
            label: UNPKG_URL_PREFIX,
            kind: CompletionItemKind.Folder,
            replacementStartIndex: urlPrefix.index,
            state
          })
        ],
        true
      );
    }

    if (packageName && !version && !filePath) {
      // Suggest package names
      const suggestionNames = await searchPackageNames(packageName.text);
      const packageCompletionItems = suggestionNames.map(
        name =>
          new PathPartCompletionItem({
            label: name,
            kind: CompletionItemKind.Module,
            replacementStartIndex: packageName.index,
            state
          })
      );

      return new CompletionList(packageCompletionItems, true);
    }

    if (packageName && version && !filePath) {
      // suggest version
      const versionSansAtSign = version.text.substring(1);
      const versionsAndTags = await getVersionsAndTags(packageName.text);
      if (!versionsAndTags) return new CompletionList([], true);

      const versionSuggestions = versionsAndTags.versions
        .filter(v => v.startsWith(versionSansAtSign))
        .concat(
          versionsAndTags.tags.filter(t => t.startsWith(versionSansAtSign))
        )
        .slice(0, 10);
      const versionCompletionItems = versionSuggestions.map((v, i) => {
        return new PathPartCompletionItem({
          label: v,
          kind: CompletionItemKind.Folder,
          replacementStartIndex: version.index + 1,
          state,
          // to preserve the original sorting
          sortText: String.fromCharCode(65 + i)
        });
      });

      return new CompletionList(versionCompletionItems, true);
    }

    if (packageName && filePath) {
      const filePaths = await getFilePaths(
        `${packageName.text}${version ? version.text : ""}`
      );
      if (!filePaths) return new CompletionList([], true);

      const filePathCompletionItems = filePaths
        .filter(file => file.startsWith(filePath.text))
        .slice(0, 30)
        .map(
          (file, i) =>
            new PathPartCompletionItem({
              label: file,
              kind: CompletionItemKind.File,
              replacementStartIndex: filePath.index,
              state,
              // to preserve the original sorting
              sortText: String.fromCharCode(65 + i)
            })
        );

      return new CompletionList(filePathCompletionItems, true);
    }

    return new CompletionList([], true);
  }
}

function isImport(currentLineText: string, position: number): boolean {
  const isImport = currentLineText.substring(0, 6) === "import";
  return (
    isImport &&
    (isAfterFrom(currentLineText, position) ||
      isImportWithoutFrom(currentLineText, position))
  );
}

function isAfterFrom(currentLineText: string, position: number) {
  let fromPosition = stringMatches(currentLineText, [
    " from '",
    ' from "',
    "}from '",
    '}from "'
  ]);

  return fromPosition != -1 && fromPosition < position;
}

function isImportWithoutFrom(currentLineText: string, postition: number) {
  let modulePosition = stringMatches(
    currentLineText,
    [
      " '", // spec calls for a space, e.g. `import 'module-name';`
      "'", // tested with babel, it doesn't care if there is a space, so `import'module-name';` is valid too,
      '"',
      ' "'
    ],
    true
  );
  return modulePosition != -1 && modulePosition < postition;
}

function stringMatches(
  textCurrentLine: string,
  strings: string[],
  searchFromStart = false
): number {
  return strings.reduce((position, str) => {
    let textPosition = searchFromStart
      ? textCurrentLine.indexOf(str)
      : textCurrentLine.lastIndexOf(str);

    return Math.max(position, textPosition);
  }, -1);
}

function isLocalModuleImport(textCurrentLine: string, position: number) {
  const textWithinString = getTextWithinString(textCurrentLine, position);
  return (
    textWithinString &&
    textWithinString.length > 0 &&
    textWithinString[0] === "."
  );
}

function getTextWithinString(
  text: string,
  position: number
): string | undefined {
  const textToPosition = text.substring(0, position);
  const quoatationPosition = Math.max(
    textToPosition.lastIndexOf('"'),
    textToPosition.lastIndexOf("'")
  );
  return quoatationPosition != -1
    ? textToPosition.substring(quoatationPosition + 1, textToPosition.length)
    : undefined;
}
