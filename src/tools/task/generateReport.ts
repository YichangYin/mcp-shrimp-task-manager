import { z } from "zod";
import { UUID_V4_REGEX } from "../../utils/regex.js";
import { getTaskById } from "../../models/taskModel.js";
import { TaskStatus } from "../../types/index.js";
import { getGenerateReportPrompt } from "../../prompts/index.js";

// 生成進度報告工具
// Generate report tool
export const generateReportSchema = z.object({
  task_ids: z
    .array(z.string().regex(UUID_V4_REGEX, { message: "任務ID格式無效" }))
    .min(1, { message: "至少需要提供一個任務ID" })
    .describe("要報告的任務ID列表"),
  report_type: z
    .enum(["summary", "detailed", "retrospective"])
    .describe("報告類型：summary(摘要)/detailed(詳細)/retrospective(回顧)"),
});

export async function generateReport({
  task_ids,
  report_type,
}: z.infer<typeof generateReportSchema>) {
  try {
    const tasks: Array<{
      id: string;
      name: string;
      status: string;
      summary?: string;
      implementationGuide?: string;
      verificationCriteria?: string;
    }> = [];

    for (const taskId of task_ids) {
      const task = await getTaskById(taskId);
      if (task) {
        tasks.push({
          id: task.id,
          name: task.name,
          status: task.status,
          summary: task.summary,
          implementationGuide: task.implementationGuide,
          verificationCriteria: task.verificationCriteria,
        });
      }
    }

    // 統計
    // Statistics
    const completedCount = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const inProgressCount = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const pendingCount = tasks.filter((t) => t.status === TaskStatus.PENDING).length;

    const prompt = await getGenerateReportPrompt({
      reportType: report_type,
      tasks,
      totalTasks: tasks.length,
      completedCount,
      inProgressCount,
      pendingCount,
    });

    return { content: [{ type: "text" as const, text: prompt }] };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `生成報告時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
