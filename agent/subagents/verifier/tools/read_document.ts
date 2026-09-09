import { defineTool } from "eve/tools";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  extractCaseId,
  getApprovedBaselineDocumentPath,
  getBaselineDocumentPath,
  readCaseDocument,
} from "../../../lib/documents/storage.ts";

export default defineTool({
  description:
    "Read an approved assurance artefact document from Vercel Blob storage, falling back to the local sandbox case directory if necessary.",
  inputSchema: z.object({
    filename: z
      .string()
      .describe(
        "Filename of the document to read, e.g. implementation-requirements.md, change-design.md, security-and-data-review.md, or policy-applicability.md"
      ),
    fromApproved: z
      .boolean()
      .optional()
      .describe("Whether to read specifically from the approved baseline snapshot (defaults to true)"),
    revision: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Specific revision number to read if not from approved snapshot"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    caseId: z.string(),
    filename: z.string(),
    source: z.enum(["blob", "sandbox", "not_found"]),
    content: z.string(),
    error: z.string().optional(),
  }),
  async execute({ filename, fromApproved = true, revision }, ctx) {
    const caseId = extractCaseId(ctx);

    // Determine target lookup paths
    const targetPaths: string[] = [];
    if (fromApproved && !filename.includes("/")) {
      targetPaths.push(getApprovedBaselineDocumentPath(filename));
    }
    if (revision !== undefined && !filename.includes("/")) {
      targetPaths.push(getBaselineDocumentPath(revision, filename));
    }
    targetPaths.push(filename);

    // 1. Try reading from Vercel Blob
    for (const targetPath of targetPaths) {
      try {
        const blobContent = await readCaseDocument(caseId, targetPath);
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
          `Notice: Could not read ${targetPath} from Vercel Blob (case: ${caseId}):`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // 2. Fall back to shared sandbox workspace
    try {
      const sandbox = await ctx.getSandbox();
      for (const targetPath of targetPaths) {
        try {
          const sandboxRelativePath = `cases/${caseId}/${targetPath}`;
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
        } catch {
          // Continue to next candidate
        }
      }
    } catch (error) {
      console.warn(
        `Notice: Sandbox workspace error for ${filename} (case: ${caseId}):`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // 3. Fall back to host workspace directory
    for (const targetPath of targetPaths) {
      try {
        const hostFile = path.resolve(
          process.cwd(),
          "agent/sandbox/workspace/cases",
          caseId,
          targetPath
        );
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
        // Intentionally fall through to next candidate
      }
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
