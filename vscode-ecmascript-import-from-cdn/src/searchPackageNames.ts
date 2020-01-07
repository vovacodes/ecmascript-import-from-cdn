import fetch from "node-fetch";

export async function searchPackageNames(query: string): Promise<string[]> {
  const response = await fetch(`http://localhost:8080/v1/${query}`);
  const suggestions: string[] = await response.json();
  return suggestions;
}
