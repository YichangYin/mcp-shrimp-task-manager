import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getProjectRoot } from "../../utils/paths.js";
import { getAnalyzeProjectPrompt } from "../../prompts/index.js";

// 項目結構分析工具
// Analyze project tool
export const analyzeProjectSchema = z.object({
  directory: z
    .string()
    .optional()
    .describe("目標目錄，默認為專案根目錄"),
  max_depth: z
    .number()
    .int()
    .positive()
    .max(5)
    .default(3)
    .describe("最大遍歷深度，默認3，最大5"),
  exclude_patterns: z
    .array(z.string())
    .optional()
    .describe("排除的目錄/文件模式，默認排除 node_modules, .git, dist, .next"),
});

const DEFAULT_EXCLUDES = ["node_modules", ".git", "dist", ".next", ".idea", ".vscode", "coverage"];

interface FileEntry {
  name: string;
  type: "file" | "dir";
  ext?: string;
  category?: string;
  depth: number;
}

function categorizeFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower === "index.ts" || lower === "index.js" || lower === "main.ts" || lower === "main.js" || lower === "app.ts" || lower === "app.js") return " entry";
  if (lower.includes("test") || lower.includes("spec")) return "🧪 test";
  if (lower.includes("schema")) return "📋 schema";
  if (lower.includes("model")) return "️ model";
  if (lower.includes("prompt") || lower.includes("template")) return "💬 prompt";
  if (lower.includes("config") || lower === ".env" || lower === ".env.example") return "️ config";
  if (lower.includes("util") || lower.includes("helper")) return "🔧 util";
  if (lower === "package.json") return "📦 package";
  if (lower === "tsconfig.json" || lower === "jsconfig.json") return "⚙️ tsconfig";
  if (lower === "readme.md" || lower.endsWith(".md")) return "📝 doc";
  return "📄 file";
}

async function scanDirectory(
  dir: string,
  depth: number,
  maxDepth: number,
  excludes: string[]
): Promise<{ tree: string; stats: Map<string, number>; fileCount: number }> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const lines: string[] = [];
  const stats = new Map<string, number>();
  let fileCount = 0;

  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (excludes.includes(entry.name)) continue;

    const prefix = "  ".repeat(depth);
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (depth < maxDepth) {
        lines.push(`${prefix}📁 ${entry.name}/`);
        const sub = await scanDirectory(fullPath, depth + 1, maxDepth, excludes);
        lines.push(...sub.tree.split("\n").filter(Boolean));
        sub.stats.forEach((count, ext) => {
          stats.set(ext, (stats.get(ext) || 0) + count);
        });
        fileCount += sub.fileCount;
      } else {
        lines.push(`${prefix}📁 ${entry.name}/ (depth limit)`);
      }
    } else {
      const category = categorizeFile(entry.name);
      const ext = entry.name.includes(".") ? entry.name.split(".").pop()!.toLowerCase() : "no-ext";
      stats.set(ext, (stats.get(ext) || 0) + 1);
      fileCount++;
      lines.push(`${prefix}${category} ${entry.name}`);
    }
  }

  return { tree: lines.join("\n"), stats, fileCount };
}

export async function analyzeProject({
  directory,
  max_depth = 3,
  exclude_patterns,
}: z.infer<typeof analyzeProjectSchema>) {
  try {
    const projectRoot = getProjectRoot();
    const targetDir = directory
      ? (path.isAbsolute(directory) ? directory : path.join(projectRoot, directory))
      : projectRoot;
    const excludes = exclude_patterns || DEFAULT_EXCLUDES;

    const { tree, stats, fileCount } = await scanDirectory(targetDir, 0, max_depth, excludes);

    // 構建統計信息
    // Build statistics
    const langStats = Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ext, count]) => `**.${ext}**: ${count} 個文件`)
      .join("\n");

    const prompt = await getAnalyzeProjectPrompt({
      directory: path.relative(projectRoot, targetDir) || ".",
      fileCount,
      tree,
      langStats,
      maxDepth: max_depth,
    });

    return { content: [{ type: "text" as const, text: prompt }] };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `分析項目時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
