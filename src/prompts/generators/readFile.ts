/**
 * readFile prompt 生成器
 * readFile prompt generator
 */

import { loadPrompt, generatePrompt, loadPromptFromTemplate } from "../loader.js";

export interface ReadFilePromptParams {
  status: "success" | "notFound" | "error";
  path: string;
  content?: string;
  totalLines?: number;
  startLine?: number;
  endLine?: number;
  truncated?: boolean;
  error?: string;
}

export async function getReadFilePrompt(params: ReadFilePromptParams): Promise<string> {
  switch (params.status) {
    case "notFound": {
      const template = await loadPromptFromTemplate("readFile/notFound.md");
      const prompt = generatePrompt(template, { path: params.path });
      return loadPrompt(prompt, "READ_FILE");
    }
    case "error": {
      const template = await loadPromptFromTemplate("readFile/error.md");
      const prompt = generatePrompt(template, { path: params.path, error: params.error || "" });
      return loadPrompt(prompt, "READ_FILE");
    }
    case "success": {
      const template = await loadPromptFromTemplate("readFile/index.md");
      const prompt = generatePrompt(template, {
        path: params.path,
        content: params.content || "",
        totalLines: String(params.totalLines || 0),
        startLine: String(params.startLine || 1),
        endLine: String(params.endLine || 0),
        truncated: params.truncated ? "⚠️ 文件內容已截斷，請使用 start_line 和 end_line 參數分段讀取。" : "",
      });
      return loadPrompt(prompt, "READ_FILE");
    }
  }
}
