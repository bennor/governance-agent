import { defineTool } from "eve/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  extractCaseId,
  getBaselineDocumentPath,
  saveCaseDocumentVersion,
} from "../../../lib/documents/storage.ts";

export default defineTool({
  description:
    "Persist an assurance artefact document to Vercel Blob and the shared local sandbox workspace.",
  inputSchema: z.object({
    filename: z
      .string()
      .describe(
        "Standard artefact filename: change-design.md, security-and-data-review.md, implementation-requirements.md, or policy-applicability.md"
      ),
    title: z.string().describe("Human-readable title of the document"),
    content: z.string().describe("Complete Markdown text of the assurance artefact"),
    revision: z.number().int().positive().optional().describe("Revision number (defaults to 1)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    caseId: z.string(),
    filename: z.string(),
    revision: z.number(),
    title: z.string(),
    blobUrl: z.string().optional(),
    blobPathname: z.string().optional(),
    sandboxPath: z.string(),
  }),
  async execute({ filename, title, content, revision = 1 }, ctx) {
    const caseId = extractCaseId(ctx);
    const versionedRelativePath = getBaselineDocumentPath(revision, filename);
    const sandboxDir = `cases/${caseId}`;
    const sandboxRelativePath = `${sandboxDir}/${filename}`;
    const sandboxVersionedPath = `${sandboxDir}/${versionedRelativePath}`;
    const sandboxFullPath = `/workspace/${sandboxRelativePath}`;

    // 1. Persist to shared sandbox cache (both unversioned and versioned for full compatibility)
    const sandbox = await ctx.getSandbox();
    await sandbox.run({
      command: `mkdir -p ${sandboxDir} ${sandboxDir}/baseline/revision-${revision}`,
    });
    await sandbox.writeTextFile({
      path: sandboxRelativePath,
      content,
    });
    await sandbox.writeTextFile({
      path: sandboxVersionedPath,
      content,
    });

    // 2. Persist to Vercel Blob storage (saves versioned path and mirrors to root)
    let blobUrl: string | undefined;
    let blobPathname: string | undefined;

    try {
      const blobResult = await saveCaseDocumentVersion(
        caseId,
        revision,
        filename,
        content
      );
      blobUrl = blobResult.url;
      blobPathname = blobResult.pathname;
    } catch (error) {
      console.warn(
        `Warning: Vercel Blob save skipped or failed for ${filename} revision ${revision} (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // 3. Persist to host repository filesystem for direct local visibility
    try {
      const hostDir = path.resolve(process.cwd(), "agent/sandbox/workspace/cases", caseId);
      const hostVersionDir = path.resolve(hostDir, `baseline/revision-${revision}`);
      await fs.mkdir(hostVersionDir, { recursive: true });
      await fs.writeFile(path.join(hostDir, filename), content, "utf8");
      await fs.writeFile(path.join(hostVersionDir, filename), content, "utf8");
    } catch (hostError) {
      console.warn(
        `Notice: Could not write host filesystem copy for ${filename}:`,
        hostError instanceof Error ? hostError.message : String(hostError)
      );
    }

    return {
      success: true,
      caseId,
      filename,
      revision,
      title,
      blobUrl,
      blobPathname,
      sandboxPath: sandboxFullPath,
    };
  },
});
