import { defineTool } from "eve/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  extractCaseId,
  getSafeStorageDir,
  getVerificationReportPath,
  getVerificationResultPath,
  saveVerificationReport,
} from "../../../lib/documents/storage.ts";

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
    findings: z
      .array(
        z.object({
          controlId: z.string(),
          status: z.enum(["pass", "fail", "not_applicable"]),
          title: z.string(),
          evidence: z.string(),
          remediation: z.string().optional(),
        })
      )
      .optional()
      .describe("Structured audit findings"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    caseId: z.string(),
    attempt: z.number(),
    filename: z.string(),
    verdict: z.enum(["compliant", "non_compliant", "unable_to_verify"]),
    blobUrl: z.string().optional(),
    blobPathname: z.string().optional(),
    resultUrl: z.string().optional(),
    sandboxPath: z.string(),
  }),
  async execute({ attempt, verdict, content, findings }, ctx) {
    const caseId = extractCaseId(ctx);
    const filename = `verification-report-attempt-${attempt}.md`;
    const versionedReportRelativePath = getVerificationReportPath(attempt);
    const versionedResultRelativePath = getVerificationResultPath(attempt);

    const sandboxDir = `cases/${caseId}`;
    const sandboxRelativePath = `${sandboxDir}/${filename}`;
    const sandboxVersionedPath = `${sandboxDir}/${versionedReportRelativePath}`;
    const sandboxFullPath = `/workspace/${sandboxRelativePath}`;

    // 1. Write to sandbox workspace (both root and versioned attempt paths)
    const sandbox = await ctx.getSandbox();
    await sandbox.run({
      command: `mkdir -p ${sandboxDir} ${sandboxDir}/verification/attempt-${attempt}`,
    });
    await sandbox.writeTextFile({
      path: sandboxRelativePath,
      content,
    });
    await sandbox.writeTextFile({
      path: sandboxVersionedPath,
      content,
    });
    if (findings) {
      await sandbox.writeTextFile({
        path: `${sandboxDir}/${versionedResultRelativePath}`,
        content: JSON.stringify({ attempt, verdict, findings }, null, 2),
      });
    }

    // 2. Write to Vercel Blob
    let blobUrl: string | undefined;
    let blobPathname: string | undefined;
    let resultUrl: string | undefined;

    try {
      const blobResult = await saveVerificationReport({
        caseId,
        attempt,
        content,
        result: findings ? { attempt, verdict, findings } : undefined,
      });
      blobUrl = blobResult.url;
      blobPathname = blobResult.pathname;
      resultUrl = blobResult.resultUrl;
    } catch (error) {
      console.warn(
        `Warning: Vercel Blob report save failed for attempt ${attempt} (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // 3. Persist to host repository filesystem for direct local visibility
    try {
      const hostDir = getSafeStorageDir(caseId);
      const hostAttemptDir = path.resolve(hostDir, `verification/attempt-${attempt}`);
      await fs.mkdir(hostAttemptDir, { recursive: true });
      await fs.writeFile(path.join(hostDir, filename), content, "utf8");
      await fs.writeFile(path.join(hostAttemptDir, filename), content, "utf8");
      if (findings) {
        await fs.writeFile(
          path.join(hostAttemptDir, "result.json"),
          JSON.stringify({ attempt, verdict, findings }, null, 2),
          "utf8"
        );
      }
    } catch (hostError) {
      console.warn(
        `Notice: Could not write host filesystem copy for ${filename}:`,
        hostError instanceof Error ? hostError.message : String(hostError)
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
      resultUrl,
      sandboxPath: sandboxFullPath,
    };
  },
});
