/**
 * saveSnippet prompt 生成器
 * saveSnippet prompt generator
 */

import { loadPrompt, generatePrompt, loadPromptFromTemplate } from "../loader.js";

export interface SaveSnippetPromptParams {
  mode: "saved" | "retrieved" | "listed" | "notFound";
  name?: string;
  code?: string;
  description?: string;
  language?: string;
  tags?: string[];
  query?: string;
  results?: Array<{ name: string; description: string; language: string; tags: string[]; preview: string }>;
  snippets?: Array<{ name: string; language: string; tags: string[]; description: string }>;
}

export async function getSaveSnippetPrompt(params: SaveSnippetPromptParams): Promise<string> {
  const { mode } = params;

  switch (mode) {
    case "saved": {
      const template = await loadPromptFromTemplate("saveSnippet/saved.md");
      const prompt = generatePrompt(template, {
        name: params.name || "",
        language: params.language || "",
        tags: params.tags?.join(", ") || "無",
        description: params.description || "",
      });
      return loadPrompt(prompt, "SAVE_SNIPPET");
    }
    case "retrieved": {
      const template = await loadPromptFromTemplate("saveSnippet/retrieved.md");
      if (params.query && params.results) {
        const resultsList = params.results
          .map((r) => `**${r.name}** (\`${r.language}\`) - ${r.description}\n${r.preview}\n標籤: ${r.tags.join(", ") || "無"}`)
          .join("\n\n---\n\n");
        const prompt = generatePrompt(template, {
          query: params.query,
          count: String(params.results.length),
          results: resultsList,
        });
        return loadPrompt(prompt, "SAVE_SNIPPET");
      }
      const prompt = generatePrompt(template, {
        name: params.name || "",
        code: params.code || "",
        description: params.description || "",
        language: params.language || "",
        tags: params.tags?.join(", ") || "無",
      });
      return loadPrompt(prompt, "SAVE_SNIPPET");
    }
    case "listed": {
      const template = await loadPromptFromTemplate("saveSnippet/listed.md");
      const list = (params.snippets || [])
        .map((s) => `- **${s.name}** (\`${s.language}\`) - ${s.description} | 標籤: ${s.tags.join(", ") || "無"}`)
        .join("\n");
      const prompt = generatePrompt(template, {
        count: String(params.snippets?.length || 0),
        list,
      });
      return loadPrompt(prompt, "SAVE_SNIPPET");
    }
    case "notFound": {
      const template = await loadPromptFromTemplate("saveSnippet/notFound.md");
      const prompt = generatePrompt(template, { name: params.name || "" });
      return loadPrompt(prompt, "SAVE_SNIPPET");
    }
  }
}
