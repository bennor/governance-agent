import { defineTool } from "eve/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { extractCaseId, readCaseDocument } from "../../../lib/documents/storage.js";

export default defineTool({
  description:
    "Read an approved assurance artefact document from Vercel Blob storage, falling back to the local sandbox case directory if necessary.",
  inputSchema: z.object({
    filename: z
      .string()
      .describe(
        "Filename of the document to read, e.g. implementation-requirements.md, change-design.md, security-and-data-review.md, or policy-applicability.md",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    caseId: z.string(),
    filename: z.string(),
    source: z.enum(["blob", "sandbox", "not_found"]),
    content: z.string(),
    error: z.string().optional(),
  }),
  async execute({ filename }, ctx) {
    const caseId = extractCaseId(ctx);

    // 1. Try reading from Vercel Blob
    try {
      const blobContent = await readCaseDocument(caseId, filename);
      if (typeof blobContent === "string" && blobContent.length > 0) {
        return {
          success: true,
          caseId,
          filename,
          source: "blob",
          content: blobContent,
        };
      }
    } catch (error) {
      console.warn(
        `Notice: Could not read ${filename} from Vercel Blob (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error),
      );
    }

    // 2. Fall back to shared sandbox workspace
    try {
      const sandbox = await ctx.getSandbox();
      const sandboxRelativePath = `cases/${caseId}/${filename}`;
      const sandboxContent = await sandbox.readTextFile({
        path: sandboxRelativePath,
      });

      if (typeof sandboxContent === "string" && sandboxContent.length > 0) {
        return {
          success: true,
          caseId,
          filename,
          source: "sandbox",
          content: sandboxContent,
        };
      }
    } catch (error) {
      console.warn(
        `Notice: Could not read ${filename} from sandbox workspace (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error),
      );
    }

    // 3. Fall back to host workspace directory
    try {
      const hostFile = path.resolve(process.cwd(), "agent/sandbox/workspace/cases", caseId, filename);
      const hostContent = await fs.readFile(hostFile, "utf8");
      if (typeof hostContent === "string" && hostContent.length > 0) {
        return {
          success: true,
          caseId,
          filename,
          source: "sandbox",
          content: hostContent,
        };
      }
    } catch {
      // Intentionally fall through to not_found
    }

    return {
      success: false,
      caseId,
      filename,
      source: "not_found",
      content: "",
      error: `Document "${filename}" not found in Vercel Blob or sandbox for case "${caseId}".`,
    };
  },
});
