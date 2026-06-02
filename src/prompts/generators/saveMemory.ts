/**
 * saveMemory prompt 生成器
 * saveMemory prompt generator
 */

import { loadPrompt, generatePrompt, loadPromptFromTemplate } from "../loader.js";

export interface SaveMemoryPromptParams {
  mode: "saved" | "retrieved" | "listed" | "deleted" | "notFound";
  name?: string;
  content?: string;
  category?: string;
  tags?: string[];
  filePath?: string;
  updatedAt?: string;
  query?: string;
  results?: Array<{ name: string; content: string; category: string; tags: string[] }>;
  memories?: Array<{ name: string; category: string; tags: string[]; updatedAt: string }>;
}

export async function getSaveMemoryPrompt(params: SaveMemoryPromptParams): Promise<string> {
  const { mode } = params;

  switch (mode) {
    case "saved": {
      const template = await loadPromptFromTemplate("saveMemory/saved.md");
      const prompt = generatePrompt(template, {
        name: params.name || "",
        category: params.category || "",
        tags: params.tags?.join(", ") || "無",
      });
      return loadPrompt(prompt, "SAVE_MEMORY");
    }
    case "retrieved": {
      const template = await loadPromptFromTemplate("saveMemory/retrieved.md");
      if (params.query && params.results) {
        const resultsList = params.results
          .map((r) => `**${r.name}** (${r.category}) - ${r.content}\n標籤: ${r.tags.join(", ") || "無"}`)
          .join("\n\n");
        const prompt = generatePrompt(template, {
          query: params.query,
          count: String(params.results.length),
          results: resultsList,
        });
        return loadPrompt(prompt, "SAVE_MEMORY");
      }
      const prompt = generatePrompt(template, {
        name: params.name || "",
        content: params.content || "",
        category: params.category || "",
        tags: params.tags?.join(", ") || "無",
        updatedAt: params.updatedAt || "",
      });
      return loadPrompt(prompt, "SAVE_MEMORY");
    }
    case "listed": {
      const template = await loadPromptFromTemplate("saveMemory/listed.md");
      const list = (params.memories || [])
        .map((m) => `- **${m.name}** (${m.category}) | 更新: ${m.updatedAt} | 標籤: ${m.tags.join(", ") || "無"}`)
        .join("\n");
      const prompt = generatePrompt(template, {
        count: String(params.memories?.length || 0),
        list,
      });
      return loadPrompt(prompt, "SAVE_MEMORY");
    }
    case "deleted": {
      const template = await loadPromptFromTemplate("saveMemory/deleted.md");
      const prompt = generatePrompt(template, { name: params.name || "" });
      return loadPrompt(prompt, "SAVE_MEMORY");
    }
    case "notFound": {
      const template = await loadPromptFromTemplate("saveMemory/notFound.md");
      const prompt = generatePrompt(template, { name: params.name || "" });
      return loadPrompt(prompt, "SAVE_MEMORY");
    }
  }
}
