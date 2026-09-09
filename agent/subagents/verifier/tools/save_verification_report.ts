import { defineTool } from "eve/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { extractCaseId, saveVerificationReport } from "../../../lib/documents/storage.js";

export default defineTool({
  description:
    "Save a versioned verification audit report to Vercel Blob and the shared local sandbox workspace.",
  inputSchema: z.object({
    attempt: z
      .number()
      .int()
      .min(1)
      .max(3)
      .describe("The verification attempt index (1, 2, or 3)"),
    verdict: z
      .enum(["compliant", "non_compliant", "unable_to_verify"])
      .describe("The audit determination"),
    content: z.string().describe("Complete Markdown audit verification report"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    caseId: z.string(),
    attempt: z.number(),
    filename: z.string(),
    verdict: z.enum(["compliant", "non_compliant", "unable_to_verify"]),
    blobUrl: z.string().optional(),
    blobPathname: z.string().optional(),
    sandboxPath: z.string(),
  }),
  async execute({ attempt, verdict, content }, ctx) {
    const caseId = extractCaseId(ctx);
    const filename = `verification-report-attempt-${attempt}.md`;
    const sandboxDir = `cases/${caseId}`;
    const sandboxRelativePath = `${sandboxDir}/${filename}`;
    const sandboxFullPath = `/workspace/${sandboxRelativePath}`;

    // 1. Write to sandbox workspace
    const sandbox = await ctx.getSandbox();
    await sandbox.run({ command: `mkdir -p ${sandboxDir}` });
    await sandbox.writeTextFile({
      path: sandboxRelativePath,
      content,
    });

    // 2. Write to Vercel Blob
    let blobUrl: string | undefined;
    let blobPathname: string | undefined;

    try {
      const blobResult = await saveVerificationReport({
        caseId,
        attempt,
        content,
      });
      blobUrl = blobResult.url;
      blobPathname = blobResult.pathname;
    } catch (error) {
      console.warn(
        `Warning: Vercel Blob report save failed for attempt ${attempt} (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error),
      );
    }

    // 3. Persist to host repository filesystem for direct local visibility
    try {
      const hostDir = path.resolve(process.cwd(), "agent/sandbox/workspace/cases", caseId);
      await fs.mkdir(hostDir, { recursive: true });
      await fs.writeFile(path.join(hostDir, filename), content, "utf8");
    } catch (hostError) {
      console.warn(
        `Notice: Could not write host filesystem copy for ${filename}:`,
        hostError instanceof Error ? hostError.message : String(hostError),
      );
    }

    return {
      success: true,
      caseId,
      attempt,
      filename,
      verdict,
      blobUrl,
      blobPathname,
      sandboxPath: sandboxFullPath,
    };
  },
});
