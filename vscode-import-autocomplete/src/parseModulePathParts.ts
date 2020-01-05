export const UNPKG_URL_PREFIX = "https://unpkg.com/";

const MODULE_PATH_REGEXP = /(?:\"|\')([^"']*)?$/;

/**
 * Groups:
 * ((?:@[^/]+?[/])?(?:[^/]+?)) - full package name
 * ([@][^/]*)? - optional version
 * ([/].*)? - optional file path
 */
const MODULE_PATH_PARTS_REGEXP = /^(h$|ht$|htt$|http$|https$|https:$|https:\/$|https:\/\/$|https:\/\/u$|https:\/\/un$|https:\/\/unp$|https:\/\/unpk$|https:\/\/unpkg$|https:\/\/unpkg\.$|https:\/\/unpkg\.c$|https:\/\/unpkg\.co$|https:\/\/unpkg\.com$|https:\/\/unpkg\.com\/$)|(https:\/\/unpkg\.com\/)((?:@[^/]+?[/])?(?:[^/]+?))([@][^/]*)?([/].*)?$/;

type Part = {
  // part start index in the current cursor line
  index: number;
  text: string;
};

type Parts = {
  urlPrefix: Part;
  packageName: Part | undefined;
  version: Part | undefined;
  filePath: Part | undefined;
};

export function parseModulePathParts(
  currentLineText: string,
  cursorCharacter: number
): Parts | undefined {
  const parsedModulePath = getModulePathFromLineUnderCursor(
    currentLineText,
    cursorCharacter
  );
  if (!parsedModulePath) return undefined;

  const [modulePath, modulePathStartIndex] = parsedModulePath;
  const match = modulePath.match(MODULE_PATH_PARTS_REGEXP);
  if (!match) return undefined;

  const [
    _,
    partialUrlPrefix,
    fullUrlPrefix,
    packageName,
    version,
    filePath
  ] = match;
  const urlPrefix = fullUrlPrefix ?? partialUrlPrefix;
  const urlPrefixIndex = modulePathStartIndex;

  return {
    urlPrefix: {
      index: urlPrefixIndex,
      text: urlPrefix
    },
    packageName:
      packageName != null
        ? {
            index: urlPrefixIndex + urlPrefix.length,
            text: packageName
          }
        : undefined,
    version:
      version != null
        ? {
            index: urlPrefixIndex + urlPrefix.length + packageName.length,
            text: version
          }
        : undefined,
    filePath:
      filePath != null
        ? {
            index:
              version != null
                ? urlPrefixIndex +
                  urlPrefix.length +
                  packageName.length +
                  version.length
                : urlPrefixIndex + urlPrefix.length + packageName.length,
            text: filePath
          }
        : undefined
  };
}

export function getModulePathFromLineUnderCursor(
  currentLineText: string,
  cursorCharacter: number
): [string, number] | undefined {
  const currentLineTextBeforeCursor = currentLineText.substring(
    0,
    cursorCharacter
  );

  const pathMatch = currentLineTextBeforeCursor.match(MODULE_PATH_REGEXP);
  if (pathMatch?.[1] == null || pathMatch?.index == null) {
    return undefined;
  }

  return [pathMatch[1], pathMatch.index + 1];
}
