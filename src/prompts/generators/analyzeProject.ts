/**
 * analyzeProject prompt 生成器
 * analyzeProject prompt generator
 */

import { loadPrompt, generatePrompt, loadPromptFromTemplate } from "../loader.js";

export interface AnalyzeProjectPromptParams {
  directory: string;
  fileCount: number;
  tree: string;
  langStats: string;
  maxDepth: number;
}

export async function getAnalyzeProjectPrompt(params: AnalyzeProjectPromptParams): Promise<string> {
  const template = await loadPromptFromTemplate("analyzeProject/index.md");
  const prompt = generatePrompt(template, {
    directory: params.directory,
    fileCount: String(params.fileCount),
    tree: params.tree,
    langStats: params.langStats,
    maxDepth: String(params.maxDepth),
  });
  return loadPrompt(prompt, "ANALYZE_PROJECT");
}
