/**
 * Some code here is borrowed from
 * https://github.com/mjackson/unpkg/blob/master/modules/utils/npm.js
 */
import { IncomingMessage } from "http";
import * as LRUCache from "lru-cache";
import fetch from "node-fetch";
import { rcompare } from "semver";
import { chain } from "stream-chain";
import { parser } from "stream-json/Parser";
import { ignore } from "stream-json/filters/Ignore";
import { streamValues } from "stream-json/streamers/StreamValues";
import { httpGet } from "./httpGet";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/";
const UNPKG_URL = "https://unpkg.com/";

const MEGABYTE = 1024 * 1024;
const SECOND = 1000;
const MINUTE = 60 * SECOND;

const NOT_FOUND = "";

const cache = new LRUCache<string, string>({
  max: 40 * MEGABYTE,
  length: Buffer.byteLength,
  maxAge: 60 * MINUTE,
  updateAgeOnGet: true
});

/**
 * Uses a cache to avoid over-fetching from unpkg.com.
 */
export async function getFilePaths(
  packageAndVersion: string
): Promise<string[] | null> {
  const filePathsKey = filePathsCacheKey(packageAndVersion);
  let cachedFilePaths = cache.get(filePathsKey);

  if (cachedFilePaths != null) {
    return cachedFilePaths === NOT_FOUND ? null : JSON.parse(cachedFilePaths);
  }

  console.log(`Fetching file paths for package ${packageAndVersion}...`);
  await fetchAndCacheFilePaths(packageAndVersion);
  console.log(`Done.`);

  cachedFilePaths = cache.get(filePathsKey);
  if (cachedFilePaths == null || cachedFilePaths === NOT_FOUND) return null;

  return JSON.parse(cachedFilePaths);
}

type FileTreeNode =
  | { path: string; type: "file" }
  | { path: string; type: "directory"; files: FileTreeNode[] };
async function fetchAndCacheFilePaths(
  packageAndVersion: string
): Promise<void> {
  const encodedPackageAndVersion = encodePackageName(packageAndVersion);
  const URL = `${UNPKG_URL}${encodedPackageAndVersion}/?meta`;
  const filePathsKey = filePathsCacheKey(packageAndVersion);

  try {
    const response = await fetch(URL);

    if (response.status === 404) {
      return void cache.set(filePathsKey, NOT_FOUND);
    }
    if (response.status !== 200) {
      return void console.error(
        `Error fetching file paths for package ${packageAndVersion}. Status: ${response.status}`
      );
    }

    const fileTree: FileTreeNode = await response.json();
    const filePaths = collectFileNames([fileTree])
      .filter(filePath => !filePath.endsWith(".d.ts")) // filter out d.ts files. TODO: filter out other file types too
      .sort();
    function collectFileNames(nodes: FileTreeNode[]): string[] {
      return nodes.flatMap(node => {
        if (node.type === "file") return node.path;
        return collectFileNames(node.files);
      });
    }

    cache.set(filePathsKey, JSON.stringify(filePaths));
  } catch (error) {
    console.error(`Error fetching file paths for package ${packageAndVersion}`);
  }
}

/**
 * Uses a cache to avoid over-fetching from the registry.
 */
export async function getVersionsAndTags(
  packageName: string
): Promise<{ versions: string[]; tags: string[] } | null> {
  const versionsKey = versionsCacheKey(packageName);
  let cacheValue = cache.get(versionsKey);

  if (cacheValue != null) {
    return cacheValue === NOT_FOUND ? null : JSON.parse(cacheValue);
  }

  console.log(`Fetching info for package ${packageName}...`);
  await fetchAndCachePackageInfo(packageName);
  console.log(`Done.`);
  cacheValue = cache.get(versionsKey);

  if (cacheValue == null || cacheValue === NOT_FOUND) return null;

  return JSON.parse(cacheValue);
}

async function fetchAndCachePackageInfo(packageName: string): Promise<void> {
  const name = encodePackageName(packageName);
  const infoURL = `${NPM_REGISTRY_URL}/${name}`;
  const versionsKey = versionsCacheKey(packageName);
  const descriptionKey = descriptionCacheKey(packageName);

  try {
    const response = await httpGet(infoURL);

    if (response.statusCode === 404) {
      cache.set(versionsKey, NOT_FOUND);
      cache.set(descriptionKey, NOT_FOUND);
      return;
    }
    if (response.statusCode !== 200) {
      return void console.error(
        `Error fetching info for package ${packageName}. Status: ${response.statusCode}`
      );
    }

    const info = await parseInfoJSON(response);
    const versions = Object.keys(info.versions).sort(rcompare); // sorted in semver descending order
    const tags = Object.keys(info["dist-tags"]).sort(); // sorted in ASCII char order

    cache.set(versionsKey, JSON.stringify({ versions, tags }));
    if (info.description) {
      cache.set(descriptionKey, JSON.stringify(info.description));
    }
  } catch (error) {
    console.error(`Error fetching info for package ${packageName}`);
  }
}

/**
 * Selectively parses the huge package info response
 * to only extract fields we are interested in
 */
function parseInfoJSON(
  response: IncomingMessage
): Promise<{
  description: string;
  "dist-tags": { [version: string]: unknown };
  versions: { [version: string]: unknown };
}> {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      response,
      parser({ streamKeys: false, packKeys: true }),
      // @ts-ignore
      ignore({
        filter(stack, chunk) {
          const [level1Key, level2Key, level3Key] = stack;

          // don't ignore top-level object chunks
          if (level1Key == null) return false;

          // don't ignore "desctiption" chunk
          if (level1Key === "description") return false;

          // don't ignore "dist-tags" chunk
          if (level1Key === "dist-tags") return false;

          if (level1Key === "versions") {
            // don't ignore "versions" chunk
            if (level2Key == null) return false;

            // don't ignore "versions.xxx" chunks
            if (level2Key != null && level3Key == null) return false;

            // ignore "versions.xxx.yyy" chunks
            if (level2Key != null && level3Key != null) return true;
          }

          // ignore everything else
          return true;
        }
      }),
      // @ts-ignore
      streamValues()
    ]);

    pipeline.on("error", reject);
    pipeline.on("data", data => {
      resolve(data.value);
    });
  });
}

function versionsCacheKey(packageName: string): string {
  return `versions-${packageName}`;
}

function descriptionCacheKey(packageName: string): string {
  return `description-${packageName}`;
}

function filePathsCacheKey(packageName: string): string {
  return `filePaths-${packageName}`;
}

/**
 * Encodes everything but @'s
 */
function encodePackageName(packageName: string) {
  return packageName
    .split("@")
    .map(part => encodeURIComponent(part))
    .join("@");
}
