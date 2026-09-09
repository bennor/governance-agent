import { defineAgent } from "eve";
import { z } from "zod";

export default defineAgent({
  description:
    "Specialist station that audits public GitHub pull request implementations against approved assurance requirements, records findings with file and line evidence, and generates versioned compliance reports.",
  model: "openai/gpt-5.6-luna-fast",
  outputSchema: z.object({
    verdict: z
      .enum(["compliant", "non_compliant", "unable_to_verify"])
      .describe("Overall compliance determination for the pull request"),
    attempt: z.number().describe("Verification attempt number (1, 2, or 3)"),
    summary: z.string().describe("Executive audit summary of the verification"),
    pullRequestUrl: z.string().describe("The GitHub pull request URL inspected"),
    blockingCount: z
      .number()
      .describe("Number of failing or non-compliant controls preventing release"),
    findings: z
      .array(
        z.object({
          controlId: z.string(),
          status: z.enum(["pass", "fail", "not_applicable"]),
          title: z.string(),
          evidence: z.string().describe("Specific code files, line numbers, and observations"),
          remediation: z
            .string()
            .optional()
            .describe("Actionable instructions to resolve the finding if non-compliant"),
        }),
      )
      .describe("Control-by-control audit determinations"),
    reportPath: z.string().describe("Path to the saved report in the sandbox"),
    reportBlobUrl: z
      .string()
      .optional()
      .describe("URL to the saved report in Vercel Blob storage"),
  }),
});
