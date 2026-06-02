import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getDataDir } from "../../utils/paths.js";
import { getSaveSnippetPrompt } from "../../prompts/index.js";

const snippetModeEnum = z.enum(["save", "retrieve", "list"]);

// 保存代碼片段工具
// Save snippet tool
export const saveSnippetSchema = z.object({
  mode: snippetModeEnum.describe("操作模式：save(保存)/retrieve(檢索)/list(列表)"),
  name: z
    .string()
    .optional()
    .describe("片段名稱，save/retrieve 模式必填"),
  code: z
    .string()
    .optional()
    .describe("代碼內容，save 模式必填"),
  description: z
    .string()
    .optional()
    .describe("片段描述，save 模式必填"),
  language: z
    .string()
    .optional()
    .describe("代碼語言，如 typescript, python"),
  tags: z
    .array(z.string())
    .optional()
    .describe("標籤列表"),
  query: z
    .string()
    .optional()
    .describe("搜索關鍵字，retrieve 模式用於關鍵詞搜索"),
});

interface SnippetEntry {
  name: string;
  code: string;
  description: string;
  language: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

async function getSnippetDir(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "snippets");
}

async function ensureSnippetDir(): Promise<void> {
  const dir = await getSnippetDir();
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readSnippet(name: string): Promise<SnippetEntry | null> {
  const dir = await getSnippetDir();
  const filePath = path.join(dir, `${name}.json`);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function listAllSnippets(): Promise<SnippetEntry[]> {
  const dir = await getSnippetDir();
  const results: SnippetEntry[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const data = await fs.readFile(path.join(dir, entry.name), "utf-8");
        results.push(JSON.parse(data));
      }
    }
  } catch {}
  return results;
}

export async function saveSnippet({
  mode,
  name,
  code,
  description,
  language = "unknown",
  tags = [],
  query,
}: z.infer<typeof saveSnippetSchema>) {
  try {
    await ensureSnippetDir();

    switch (mode) {
      case "save": {
        if (!name || !code || !description) {
          return {
            content: [
              {
                type: "text" as const,
                text: `## 參數錯誤\n\nsave 模式需要提供 name（片段名稱）、code（代碼內容）、description（描述）。`,
              },
            ],
            isError: true,
          };
        }

        const dir = await getSnippetDir();
        const filePath = path.join(dir, `${name}.json`);
        const existing = await readSnippet(name);
        const now = new Date().toISOString();

        const entry: SnippetEntry = {
          name,
          code,
          description,
          language,
          tags,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");

        const prompt = await getSaveSnippetPrompt({
          mode: "saved",
          name,
          language,
          tags,
          description,
        });
        return { content: [{ type: "text" as const, text: prompt }] };
      }

      case "retrieve": {
        if (name) {
          const snippet = await readSnippet(name);
          if (!snippet) {
            const prompt = await getSaveSnippetPrompt({ mode: "notFound", name });
            return { content: [{ type: "text" as const, text: prompt }] };
          }
          const prompt = await getSaveSnippetPrompt({
            mode: "retrieved",
            name: snippet.name,
            code: snippet.code,
            description: snippet.description,
            language: snippet.language,
            tags: snippet.tags,
          });
          return { content: [{ type: "text" as const, text: prompt }] };
        } else if (query) {
          const snippets = await listAllSnippets();
          const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 0);
          const matched = snippets.filter((s) =>
            keywords.every((kw) =>
              s.code.toLowerCase().includes(kw) ||
              s.name.toLowerCase().includes(kw) ||
              s.description.toLowerCase().includes(kw) ||
              s.tags.some((t) => t.toLowerCase().includes(kw))
            )
          );
          const prompt = await getSaveSnippetPrompt({
            mode: "retrieved",
            query,
            results: matched.map((s) => ({
              name: s.name,
              description: s.description,
              language: s.language,
              tags: s.tags,
              preview: s.code.substring(0, 200) + (s.code.length > 200 ? "..." : ""),
            })),
          });
          return { content: [{ type: "text" as const, text: prompt }] };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `## 參數錯誤\n\nretrieve 模式需要提供 name（按名稱檢索）或 query（按關鍵詞搜索）。`,
            },
          ],
          isError: true,
        };
      }

      case "list": {
        const snippets = await listAllSnippets();
        const prompt = await getSaveSnippetPrompt({
          mode: "listed",
          snippets: snippets.map((s) => ({
            name: s.name,
            language: s.language,
            tags: s.tags,
            description: s.description,
          })),
        });
        return { content: [{ type: "text" as const, text: prompt }] };
      }
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `保存代碼片段時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
