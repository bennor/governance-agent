import { z } from "zod";

export const governanceStageSchema = z.enum([
  "intake",
  "drafting",
  "baseline_review",
  "awaiting_pull_request",
  "verifying",
  "remediation",
  "approved",
  "failed",
  "cancelled",
]);

export type GovernanceStage = z.infer<typeof governanceStageSchema>;

export const governanceStatusSchema = z.enum([
  "active",
  "awaiting_approval",
  "awaiting_pr",
  "awaiting_fix",
  "completed",
  "cancelled",
  "failed",
]);

export type GovernanceStatus = z.infer<typeof governanceStatusSchema>;

export const governanceIntakeSchema = z.object({
  title: z.string().min(1, "Feature title is required"),
  summary: z.string().min(1, "Summary is required"),
  technicalScope: z.string().min(1, "Technical scope is required"),
  dataClassification: z.enum(["none", "internal", "pii", "confidential"]).default("none"),
  pullRequestUrl: z.string().optional(),
});

export type GovernanceIntake = z.infer<typeof governanceIntakeSchema>;

export const caseDocumentSchema = z.object({
  filename: z.string(),
  title: z.string().optional(),
  revision: z.number().int().positive(),
  blobUrl: z.string().optional(),
});

export type CaseDocument = z.infer<typeof caseDocumentSchema>;

export const auditFindingSchema = z.object({
  controlId: z.string(),
  status: z.enum(["pass", "fail", "not_applicable"]),
  title: z.string(),
  evidence: z.string(),
  remediation: z.string().optional(),
});

export type AuditFinding = z.infer<typeof auditFindingSchema>;

export const caseHistoryEntrySchema = z.object({
  stage: governanceStageSchema,
  timestamp: z.string(),
  note: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type CaseHistoryEntry = z.infer<typeof caseHistoryEntrySchema>;

export const caseManifestSchema = z.object({
  caseId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string(),
  intake: governanceIntakeSchema,
  stage: governanceStageSchema,
  status: governanceStatusSchema,
  activeRevision: z.number().int().positive().default(1),
  approvedRevision: z.number().int().positive().nullable().default(null),
  activeAttempt: z.number().int().min(1).max(3).nullable().default(null),
  pullRequestUrl: z.string().nullable().default(null),
  verdict: z.enum(["compliant", "non_compliant", "unable_to_verify"]).nullable().default(null),
  blockingCount: z.number().int().nonnegative().nullable().default(null),
  documents: z.array(caseDocumentSchema).default([]),
  findings: z.array(auditFindingSchema).optional(),
  history: z.array(caseHistoryEntrySchema).default([]),
});

export type CaseManifest = z.infer<typeof caseManifestSchema>;

export const workflowProgressSchema = z.object({
  stage: governanceStageSchema,
  status: governanceStatusSchema,
  revision: z.number().int().positive().optional(),
  attempt: z.number().int().min(1).max(3).optional(),
  pullRequestUrl: z.string().optional(),
  findings: z.array(auditFindingSchema).optional(),
  message: z.string().optional(),
});

export type WorkflowProgress = z.infer<typeof workflowProgressSchema>;

export const governanceCaseResultSchema = z.object({
  status: z.enum(["approved", "failed", "cancelled"]),
  caseId: z.string(),
  attempts: z.number().int().nonnegative(),
  verdict: z.enum(["compliant", "non_compliant", "unable_to_verify"]).optional(),
  summary: z.string().optional(),
});

export type GovernanceCaseResult = z.infer<typeof governanceCaseResultSchema>;
