import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const documentPaths = [
  "AGENTS.md",
  "docs/agent-rules.md",
  "docs/question-routing.md",
  "docs/metric-definitions.md",
  "docs/data-dictionary.md",
  "docs/agent-reporting.md",
  "api/openapi.yaml",
  "docs/REPO_AUDIT.md",
  "docs/MCP_TOOLS.md",
  "docs/REPORTING_METRICS.md",
];

export type KnowledgeDocument = { id: string; title: string; url: string };

export async function loadDocuments(root: string): Promise<Map<string, string>> {
  const documents = new Map<string, string>();
  for (const path of documentPaths) {
    try {
      documents.set(path, await readFile(join(root, path), "utf8"));
    } catch {
      // Optional generated docs are absent before the first build.
    }
  }
  return documents;
}

export function searchDocuments(
  documents: Map<string, string>,
  query: string,
): { results: KnowledgeDocument[] } {
  const terms = query.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  const ranked = [...documents.entries()]
    .map(([id, text]) => ({
      score: terms.reduce((total, term) => total + text.toLowerCase().split(term).length - 1, 0),
      id,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 8);
  return { results: ranked.map(({ id }) => documentSummary(id)) };
}

export function fetchDocument(
  documents: Map<string, string>,
  id: string,
): KnowledgeDocument & { text: string; metadata: { source: string } } {
  const text = documents.get(id);
  if (!text) throw new Error("Unknown knowledge document");
  return { ...documentSummary(id), text, metadata: { source: "data-reporting-kit" } };
}

function documentSummary(id: string): KnowledgeDocument {
  return {
    id,
    title: id.split("/").at(-1) ?? id,
    url: `https://github.com/lightningtransport/data-reporting-kit/blob/main/${id}`,
  };
}
