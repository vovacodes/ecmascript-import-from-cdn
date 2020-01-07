import fetch from "node-fetch";
import { NAME_SERVICE_URL } from "./config";

export async function searchPackageNames(query: string): Promise<string[]> {
  const response = await fetch(`${NAME_SERVICE_URL}${query}`);
  const suggestions: string[] = await response.json();
  return suggestions;
}
