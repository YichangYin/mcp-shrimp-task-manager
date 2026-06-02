import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { getProjectRoot } from "../../utils/paths.js";
import { getCodeSearchPrompt } from "../../prompts/index.js";

const execAsync = promisify(exec);

// 代碼搜索工具
// Code search tool
export const codeSearchSchema = z.object({
  query: z
    .string()
    .min(1, { message: "搜索內容不能為空" })
    .describe("搜索關鍵詞或正則表達式"),
  pattern: z
    .string()
    .optional()
    .describe("文件名匹配模式（glob），如 *.ts, src/**/*.tsx"),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe("最大結果數，默認20，最大100"),
  context_lines: z
    .number()
    .int()
    .min(0)
    .max(5)
    .default(2)
    .describe("每個匹配上下文的行數，默認2"),
});

interface SearchMatch {
  file: string;
  line: number;
  content: string;
  context_before: string[];
  context_after: string[];
}

export async function codeSearch({
  query,
  pattern,
  limit = 20,
  context_lines = 2,
}: z.infer<typeof codeSearchSchema>) {
  try {
    const projectRoot = getProjectRoot();
    const searchDir = projectRoot;

    // 嘗試使用 rg (ripgrep)
    // Try using rg (ripgrep)
    let cmd: string;
    const safeQuery = query.replace(/[&;`$"'<>|\\]/g, "");
    const safePattern = pattern
      ? pattern.replace(/[&;`$"'<>|\\]/g, "")
      : "";

    try {
      await execAsync("rg --version");
      // rg is available
      cmd = `cd "${searchDir}" && rg --json -C ${context_lines} --max-count ${limit} ${
        safePattern ? `-g "${safePattern}"` : ""
      } -- "${safeQuery}"`;
    } catch {
      // Fallback to grep
      const isWindows = process.platform === "win32";
      if (isWindows) {
        cmd = `cd "${searchDir}" && findstr /s /n /c:"${safeQuery}" *`;
      } else {
        cmd = `cd "${searchDir}" && grep -rn -C ${context_lines} --max-count=${limit} ${
          safePattern ? `--include="${safePattern}"` : ""
        } -- "${safeQuery}" .`;
      }
    }

    const { stdout } = await execAsync(cmd, {
      maxBuffer: 1024 * 1024 * 10,
    });

    if (!stdout.trim()) {
      const prompt = await getCodeSearchPrompt({
        found: false,
        query,
        pattern,
      });
      return { content: [{ type: "text" as const, text: prompt }] };
    }

    // 解析 rg JSON 輸出
    // Parse rg JSON output
    const matches: SearchMatch[] = [];
    try {
      const lines = stdout.trim().split("\n");
      let currentMatch: SearchMatch | null = null;

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === "match") {
            for (const sub of obj.data.submatches) {
              matches.push({
                file: obj.data.path.text,
                line: obj.data.line_number,
                content: obj.data.lines.text.trim(),
                context_before: [],
                context_after: [],
              });
            }
          }
        } catch {
          // Not JSON, skip
        }
      }
    } catch {}

    // 如果 JSON 解析失敗，嘗試解析 grep 格式
    // If JSON parsing fails, try parsing grep format
    if (matches.length === 0 && stdout.trim()) {
      const isWindows = process.platform === "win32";
      const outputLines = stdout.trim().split("\n");
      for (const line of outputLines) {
        if (!line.trim()) continue;
        if (isWindows) {
          // findstr format: file:line:content
          const parts = line.split(":");
          if (parts.length >= 3) {
            matches.push({
              file: parts[0],
              line: parseInt(parts[1], 10) || 0,
              content: parts.slice(2).join(":"),
              context_before: [],
              context_after: [],
            });
          }
        } else {
          // grep format: file:line:content or file-line-content (with context)
          const match = line.match(/^(.+?)(?::|-)(\d+)(?::|-)(.*)$/);
          if (match) {
            matches.push({
              file: match[1],
              line: parseInt(match[2], 10),
              content: match[3],
              context_before: [],
              context_after: [],
            });
          }
        }
      }
    }

    if (matches.length === 0) {
      const prompt = await getCodeSearchPrompt({
        found: false,
        query,
        pattern,
      });
      return { content: [{ type: "text" as const, text: prompt }] };
    }

    // 限制結果數量
    // Limit result count
    const limitedMatches = matches.slice(0, limit);

    const prompt = await getCodeSearchPrompt({
      found: true,
      query,
      pattern,
      matches: limitedMatches.map((m) => ({
        file: path.relative(searchDir, m.file),
        line: m.line,
        content: m.content,
      })),
      totalMatches: matches.length,
    });

    return { content: [{ type: "text" as const, text: prompt }] };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `代碼搜索時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
