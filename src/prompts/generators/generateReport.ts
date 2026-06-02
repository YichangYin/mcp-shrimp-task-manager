/**
 * generateReport prompt 生成器
 * generateReport prompt generator
 */

import { loadPrompt, generatePrompt, loadPromptFromTemplate } from "../loader.js";

export interface GenerateReportPromptParams {
  reportType: "summary" | "detailed" | "retrospective";
  tasks: Array<{
    id: string;
    name: string;
    status: string;
    summary?: string;
    implementationGuide?: string;
    verificationCriteria?: string;
  }>;
  totalTasks: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
}

export async function getGenerateReportPrompt(params: GenerateReportPromptParams): Promise<string> {
  switch (params.reportType) {
    case "summary": {
      const template = await loadPromptFromTemplate("generateReport/summary.md");
      const taskList = params.tasks
        .map((t) => `- [${t.status === "COMPLETED" ? "✅" : t.status === "IN_PROGRESS" ? "🔄" : "⏳"}] **${t.name}** (\`${t.id}\`): ${t.summary || "無摘要"}`)
        .join("\n");
      const prompt = generatePrompt(template, {
        totalTasks: String(params.totalTasks),
        completedCount: String(params.completedCount),
        inProgressCount: String(params.inProgressCount),
        pendingCount: String(params.pendingCount),
        taskList,
      });
      return loadPrompt(prompt, "GENERATE_REPORT");
    }
    case "detailed": {
      const template = await loadPromptFromTemplate("generateReport/detailed.md");
      const taskDetails = params.tasks
        .map((t) => `### ${t.name} (\`${t.id}\`)
- 狀態: ${t.status}
- 摘要: ${t.summary || "無"}
- 實現指南: ${t.implementationGuide ? t.implementationGuide.substring(0, 200) + "..." : "無"}
- 驗證標準: ${t.verificationCriteria || "無"}`)
        .join("\n\n---\n\n");
      const prompt = generatePrompt(template, {
        totalTasks: String(params.totalTasks),
        completedCount: String(params.completedCount),
        taskDetails,
      });
      return loadPrompt(prompt, "GENERATE_REPORT");
    }
    case "retrospective": {
      const template = await loadPromptFromTemplate("generateReport/retrospective.md");
      const completedTasks = params.tasks.filter((t) => t.status === "COMPLETED");
      const lessons = completedTasks
        .filter((t) => t.summary)
        .map((t) => `- **${t.name}**: ${t.summary}`)
        .join("\n");
      const prompt = generatePrompt(template, {
        totalCompleted: String(completedTasks.length),
        lessons,
        taskList: params.tasks.map((t) => `- ${t.name} (${t.status})`).join("\n"),
      });
      return loadPrompt(prompt, "GENERATE_REPORT");
    }
  }
}
