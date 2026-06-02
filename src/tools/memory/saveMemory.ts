import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getDataDir } from "../../utils/paths.js";
import { getSaveMemoryPrompt } from "../../prompts/index.js";

const memoryModeEnum = z.enum(["save", "retrieve", "list", "delete"]);
const memoryCategoryEnum = z.enum([
  "project_knowledge",
  "lesson_learned",
  "decision_record",
  "user_preference",
  "custom",
]);

// 保存記憶工具
// Save memory tool
export const saveMemorySchema = z.object({
  mode: memoryModeEnum.describe(
    "操作模式：save(保存)/retrieve(檢索)/list(列表)/delete(刪除)"
  ),
  name: z
    .string()
    .optional()
    .describe("記憶名稱/標識符，save/retrieve/delete 模式建議提供"),
  content: z
    .string()
    .min(10, { message: "記憶內容最少10個字" })
    .optional()
    .describe("記憶內容，save 模式必填，最少10字"),
  category: memoryCategoryEnum.default("custom").describe(
    "記憶分類，默認 custom"
  ),
  tags: z.array(z.string()).optional().describe("標籤列表，用於分類和搜索"),
  query: z
    .string()
    .optional()
    .describe("搜索關鍵字，retrieve 模式用於關鍵詞搜索"),
});

interface MemoryEntry {
  name: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

async function getMemoryDir(category?: string): Promise<string> {
  const dataDir = await getDataDir();
  const memDir = path.join(dataDir, "memory");
  if (category && category !== "custom") {
    return path.join(memDir, category);
  }
  return memDir;
}

async function getMemoryFilePath(name: string, category?: string): Promise<string> {
  const dir = await getMemoryDir(category);
  return path.join(dir, `${name}.json`);
}

async function ensureMemoryDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readMemoryFile(filePath: string): Promise<MemoryEntry | null> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function listAllMemories(dataDir: string): Promise<Array<MemoryEntry & { file: string }>> {
  const memDir = path.join(dataDir, "memory");
  const results: Array<MemoryEntry & { file: string }> = [];

  async function scanDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith(".json")) {
          const mem = await readMemoryFile(fullPath);
          if (mem) {
            results.push({ ...mem, file: fullPath });
          }
        }
      }
    } catch {}
  }

  await scanDir(memDir);
  return results;
}

export async function saveMemory({
  mode,
  name,
  content,
  category = "custom",
  tags = [],
  query,
}: z.infer<typeof saveMemorySchema>) {
  try {
    const dataDir = await getDataDir();

    switch (mode) {
      case "save": {
        if (!name) {
          return {
            content: [
              {
                type: "text" as const,
                text: `## 參數錯誤\n\nsave 模式需要提供記憶名稱（name 參數）。`,
              },
            ],
            isError: true,
          };
        }
        if (!content) {
          return {
            content: [
              {
                type: "text" as const,
                text: `## 參數錯誤\n\nsave 模式需要提供記憶內容（content 參數）。`,
              },
            ],
            isError: true,
          };
        }

        const dir = await getMemoryDir(category);
        await ensureMemoryDir(dir);

        const filePath = await getMemoryFilePath(name, category);
        const existing = await readMemoryFile(filePath);
        const now = new Date().toISOString();

        const entry: MemoryEntry = {
          name,
          content,
          category,
          tags,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");

        const prompt = await getSaveMemoryPrompt({
          mode: "saved",
          name,
          category,
          tags,
          filePath,
        });
        return { content: [{ type: "text" as const, text: prompt }] };
      }

      case "retrieve": {
        if (name) {
          // Retrieve by name
          const filePath = await getMemoryFilePath(name, category);
          const mem = await readMemoryFile(filePath);
          if (!mem) {
            const prompt = await getSaveMemoryPrompt({
              mode: "notFound",
              name,
            });
            return { content: [{ type: "text" as const, text: prompt }] };
          }
          const prompt = await getSaveMemoryPrompt({
            mode: "retrieved",
            name: mem.name,
            content: mem.content,
            category: mem.category,
            tags: mem.tags,
            updatedAt: mem.updatedAt,
          });
          return { content: [{ type: "text" as const, text: prompt }] };
        } else if (query) {
          // Search by keywords
          const memories = await listAllMemories(dataDir);
          const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 0);
          const matched = memories.filter((mem) =>
            keywords.every((kw) =>
              mem.content.toLowerCase().includes(kw) ||
              mem.name.toLowerCase().includes(kw) ||
              mem.tags.some((t) => t.toLowerCase().includes(kw))
            )
          );
          const prompt = await getSaveMemoryPrompt({
            mode: "retrieved",
            query,
            results: matched.map((m) => ({
              name: m.name,
              content: m.content.substring(0, 200) + (m.content.length > 200 ? "..." : ""),
              category: m.category,
              tags: m.tags,
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
        const memories = await listAllMemories(dataDir);
        const prompt = await getSaveMemoryPrompt({
          mode: "listed",
          memories: memories.map((m) => ({
            name: m.name,
            category: m.category,
            tags: m.tags,
            updatedAt: m.updatedAt,
          })),
        });
        return { content: [{ type: "text" as const, text: prompt }] };
      }

      case "delete": {
        if (!name) {
          return {
            content: [
              {
                type: "text" as const,
                text: `## 參數錯誤\n\ndelete 模式需要提供記憶名稱（name 參數）。`,
              },
            ],
            isError: true,
          };
        }
        const filePath = await getMemoryFilePath(name, category);
        try {
          await fs.unlink(filePath);
          const prompt = await getSaveMemoryPrompt({ mode: "deleted", name });
          return { content: [{ type: "text" as const, text: prompt }] };
        } catch {
          const prompt = await getSaveMemoryPrompt({ mode: "notFound", name });
          return { content: [{ type: "text" as const, text: prompt }] };
        }
      }
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `保存記憶時發生錯誤: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
