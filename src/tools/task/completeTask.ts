import { z } from "zod";
import { UUID_V4_REGEX } from "../../utils/regex.js";
import {
  getTaskById,
  updateTaskStatus,
  updateTaskSummary,
} from "../../models/taskModel.js";
import { TaskStatus } from "../../types/index.js";
import { getCompleteTaskPrompt } from "../../prompts/index.js";

// 完成任務工具
// Complete task tool
export const completeTaskSchema = z.object({
  taskId: z
    .string()
    .regex(UUID_V4_REGEX, {
      message: "任務ID格式無效，請提供有效的UUID v4格式",
      // Task ID format is invalid, please provide a valid UUID v4 format
    })
    .describe("待完成任務的唯一標識符，必須是系統中存在的有效任務ID"),
    // Unique identifier of the task to be completed, must be a valid task ID that exists in the system
  summary: z
    .string()
    .min(30, {
      message: "最少30個字",
      // Minimum 30 characters
    })
    .describe("任務完成摘要，簡潔描述實施結果和重要決策，最少30個字"),
    // Task completion summary, briefly describing implementation results and important decisions, minimum 30 characters
});

export async function completeTask({
  taskId,
  summary,
}: z.infer<typeof completeTaskSchema>) {
  try {
    const task = await getTaskById(taskId);

    if (!task) {
      return {
        content: [
          {
            type: "text" as const,
            text: `## 系統錯誤\n\n找不到ID為 \`${taskId}\` 的任務。請使用「list_tasks」工具確認有效的任務ID後再試。`,
          },
        ],
        isError: true,
      };
    }

    if (task.status !== TaskStatus.IN_PROGRESS) {
      return {
        content: [
          {
            type: "text" as const,
            text: `## 狀態錯誤\n\n任務 "${task.name}" (ID: \`${task.id}\`) 當前狀態為 "${task.status}"，不處於進行中狀態，無法完成。\n\n只有狀態為「進行中」的任務才能被完成。請先使用「execute_task」工具開始任務執行。`,
          },
        ],
        isError: true,
      };
    }

    // 更新任務摘要並標記為完成
    // Update task summary and mark as completed
    await updateTaskSummary(taskId, summary);
    await updateTaskStatus(taskId, TaskStatus.COMPLETED);

    // 使用prompt生成器獲取最終prompt
    // Use prompt generator to get final prompt
    const prompt = await getCompleteTaskPrompt({
      task,
      completionTime: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: prompt,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `完成任務時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
