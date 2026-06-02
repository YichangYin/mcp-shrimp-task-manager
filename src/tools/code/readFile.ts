import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getProjectRoot } from "../../utils/paths.js";
import { getReadFilePrompt } from "../../prompts/index.js";

// 讀取文件工具
// Read file tool
export const readFileSchema = z.object({
  path: z
    .string()
    .min(1, { message: "文件路徑不能為空" })
    .describe("文件路徑（絕對路徑或相對於專案根目錄的相對路徑）"),
  start_line: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("起始行號，默認1"),
  end_line: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("結束行號，默認讀到文件末尾"),
  limit: z
    .number()
    .int()
    .positive()
    .max(5000)
    .default(2000)
    .describe("最大讀取行數，默認2000，最大5000"),
});

export async function readFile({
  path: filePath,
  start_line = 1,
  end_line,
  limit = 2000,
}: z.infer<typeof readFileSchema>) {
  try {
    const projectRoot = getProjectRoot();
    // 解析路徑：非絕對路徑則相對於專案根目錄
    // Resolve path: relative to project root if not absolute
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectRoot, filePath);

    let content: string;
    try {
      content = await fs.readFile(resolvedPath, "utf-8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        const prompt = await getReadFilePrompt({
          status: "notFound",
          path: resolvedPath,
        });
        return { content: [{ type: "text" as const, text: prompt }] };
      }
      const prompt = await getReadFilePrompt({
        status: "error",
        path: resolvedPath,
        error: err.message,
      });
      return { content: [{ type: "text" as const, text: prompt }] };
    }

    const lines = content.split("\n");
    const totalLines = lines.length;

    // 計算實際讀取範圍
    // Calculate actual read range
    const start = Math.max(0, start_line - 1);
    const end = end_line ? Math.min(end_line, totalLines) : totalLines;
    const actualEnd = Math.min(end, start + limit);

    const slicedLines = lines.slice(start, actualEnd);
    const lineNumbers = slicedLines
      .map((line, i) => `${start + 1 + i}\t${line}`)
      .join("\n");

    const truncated = actualEnd < end;

    const prompt = await getReadFilePrompt({
      status: "success",
      path: resolvedPath,
      content: lineNumbers,
      totalLines,
      startLine: start + 1,
      endLine: actualEnd,
      truncated,
    });

    return { content: [{ type: "text" as const, text: prompt }] };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `讀取文件時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
