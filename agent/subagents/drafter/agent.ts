import { defineAgent } from "eve";
import { z } from "zod";

export default defineAgent({
  description:
    "Specialist station that analyzes feature intake prompts against policy standards, determines applicability, extracts requirements, and generates four assurance artefacts.",
  model: "openai/gpt-5.6-luna-fast",
  outputSchema: z.object({
    status: z.enum(["completed", "failed"]),
    summary: z.string().describe("Executive summary of the change governance analysis"),
    applicablePolicies: z
      .array(
        z.object({
          policyId: z.string(),
          title: z.string(),
          category: z.string(),
          reason: z.string(),
        }),
      )
      .describe("List of policies determined to apply to this change"),
    controlCount: z
      .number()
      .describe("Total number of individual normative controls identified"),
    documents: z
      .array(
        z.object({
          filename: z.string(),
          title: z.string(),
          blobUrl: z.string().optional(),
          sandboxPath: z.string(),
        }),
      )
      .describe("List of generated and saved assurance artefacts"),
  }),
});
