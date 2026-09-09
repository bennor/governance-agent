import { defineTool } from "eve/tools";
import { z } from "zod";
import { extractCaseId, saveCaseDocument } from "../../../lib/documents/storage.js";

export default defineTool({
  description:
    "Persist an assurance artefact document to Vercel Blob and the shared local sandbox workspace.",
  inputSchema: z.object({
    filename: z
      .string()
      .describe(
        "Standard artefact filename: change-design.md, security-and-data-review.md, implementation-requirements.md, or policy-applicability.md",
      ),
    title: z.string().describe("Human-readable title of the document"),
    content: z.string().describe("Complete Markdown text of the assurance artefact"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    caseId: z.string(),
    filename: z.string(),
    title: z.string(),
    blobUrl: z.string().optional(),
    blobPathname: z.string().optional(),
    sandboxPath: z.string(),
  }),
  async execute({ filename, title, content }, ctx) {
    const caseId = extractCaseId(ctx);
    const sandboxDir = `cases/${caseId}`;
    const sandboxRelativePath = `${sandboxDir}/${filename}`;
    const sandboxFullPath = `/workspace/${sandboxRelativePath}`;

    // 1. Persist to shared sandbox cache
    const sandbox = await ctx.getSandbox();
    await sandbox.run({ command: `mkdir -p ${sandboxDir}` });
    await sandbox.writeTextFile({
      path: sandboxRelativePath,
      content,
    });

    // 2. Persist to Vercel Blob storage
    let blobUrl: string | undefined;
    let blobPathname: string | undefined;

    try {
      const blobResult = await saveCaseDocument({
        caseId,
        filename,
        content,
      });
      blobUrl = blobResult.url;
      blobPathname = blobResult.pathname;
    } catch (error) {
      // If Blob storage fails (e.g. offline local development), continue with sandbox-only copy
      // but retain informative error in logging without aborting the governance run
      console.warn(
        `Warning: Vercel Blob save skipped or failed for ${filename} (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return {
      success: true,
      caseId,
      filename,
      title,
      blobUrl,
      blobPathname,
      sandboxPath: sandboxFullPath,
    };
  },
});
