/**
 * codeSearch prompt 生成器
 * codeSearch prompt generator
 */

import { loadPrompt, generatePrompt, loadPromptFromTemplate } from "../loader.js";

export interface CodeSearchPromptParams {
  found: boolean;
  query: string;
  pattern?: string;
  matches?: Array<{ file: string; line: number; content: string }>;
  totalMatches?: number;
}

export async function getCodeSearchPrompt(params: CodeSearchPromptParams): Promise<string> {
  if (!params.found) {
    const template = await loadPromptFromTemplate("codeSearch/notFound.md");
    const prompt = generatePrompt(template, {
      query: params.query,
      pattern: params.pattern || "全部文件",
    });
    return loadPrompt(prompt, "CODE_SEARCH");
  }

  const template = await loadPromptFromTemplate("codeSearch/index.md");
  const results = (params.matches || [])
    .map((m) => `**\`${m.file}\`** (第 ${m.line} 行)\n\`\`\`\n${m.content}\n\`\`\``)
    .join("\n\n---\n\n");

  const prompt = generatePrompt(template, {
    query: params.query,
    pattern: params.pattern || "全部文件",
    count: String(params.totalMatches || params.matches?.length || 0),
    results,
  });
  return loadPrompt(prompt, "CODE_SEARCH");
}
