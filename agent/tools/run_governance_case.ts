import { defineWorkflowTool } from "eve/tools";
import {
  drafterResultSchema,
  governanceCaseResultSchema,
  governanceIntakeSchema,
  verifierResultSchema,
  type GovernanceIntake,
  type WorkflowProgress,
} from "../lib/governance/schemas.ts";
import {
  freezeApprovedBaselineStep,
  initCaseStep,
  updateCaseStageStep,
  verifyBaselineDocumentsStep,
} from "../lib/governance/steps.ts";

export function extractPrUrl(text?: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/i);
  return match ? match[0] : undefined;
}

function resolveCaseId(ctx: {
  session: {
    id: string;
    parent?: {
      rootSessionId?: string;
      sessionId?: string;
    };
  };
}): string {
  return ctx.session.parent?.rootSessionId ?? ctx.session.parent?.sessionId ?? ctx.session.id;
}

// ---------------------------------------------------------------------------
// Deterministic Workflow Tool
// ---------------------------------------------------------------------------

export default defineWorkflowTool({
  description:
    "Deterministic release governance orchestrator running drafting, approval, and verification stages.",
  inputSchema: governanceIntakeSchema,
  outputSchema: governanceCaseResultSchema,
  async *execute(intake: GovernanceIntake, ctx) {
    "use workflow";

    const caseId = resolveCaseId(ctx);

    // 1. Initialise Case Manifest
    await initCaseStep(caseId, intake);
    await updateCaseStageStep(caseId, "drafting", {
      note: "Drafting stage initiated.",
    });

    const progress1: WorkflowProgress = {
      stage: "drafting",
      status: "active",
      revision: 1,
      message: "Analysing proposed change and drafting assurance baseline.",
    };
    yield progress1;

    // 2. Drafting Loop (Supports Revisions)
    let revision = 1;
    let revisionFeedback: string | undefined;

    while (true) {
      const draftJson = await ctx.agent({
        key: `draft-revision-${revision}`,
        target: "drafter",
        message: JSON.stringify({
          task: "draft",
          intake,
          revision,
          feedback: revisionFeedback,
        }),
      });

      const draftResult = drafterResultSchema.parse(draftJson);

      // Confirm physical files exist
      await verifyBaselineDocumentsStep(caseId, revision);

      // Transition to Baseline Review
      const documents = draftResult.documents.map((d) => ({
        filename: d.filename,
        title: d.title,
        revision,
        blobUrl: d.blobUrl,
      }));

      await updateCaseStageStep(caseId, "baseline_review", {
        revision,
        documents,
        note: `Baseline revision ${revision} generated with ${draftResult.controlCount} controls.`,
      });

      const reviewProgress: WorkflowProgress = {
        stage: "baseline_review",
        status: "awaiting_approval",
        revision,
        message: `Assurance baseline revision ${revision} is ready for human review.`,
      };
      yield reviewProgress;

      // Operator Checkpoint: Review Baseline
      const reviewDecision = await ctx.ask({
        prompt: `Assurance baseline revision ${revision} is ready for review (${draftResult.controlCount} controls across 4 artefacts).\n\nSummary:\n${draftResult.summary}\n\nPlease review and select your decision:`,
        display: "select",
        options: [
          { id: "approve", label: "Approve baseline", style: "primary" },
          { id: "revise", label: "Request revisions" },
          { id: "cancel", label: "Cancel change", style: "danger" },
        ],
        allowFreeform: true,
      });

      if (reviewDecision.optionId === "cancel") {
        await updateCaseStageStep(caseId, "cancelled", {
          note: "Change cancelled by operator during baseline review.",
        });
        const cancelledProgress: WorkflowProgress = {
          stage: "cancelled",
          status: "cancelled",
          revision,
          message: "Change cancelled by operator.",
        };
        yield cancelledProgress;
        return {
          status: "cancelled",
          caseId,
          attempts: 0,
          summary: "Change cancelled during baseline review.",
        };
      }

      if (reviewDecision.optionId === "revise") {
        revision += 1;
        revisionFeedback = reviewDecision.text || "Operator requested revisions.";
        await updateCaseStageStep(caseId, "drafting", {
          revision,
          note: `Revisions requested: ${revisionFeedback}`,
        });
        yield {
          stage: "drafting",
          status: "active",
          revision,
          message: `Re-drafting assurance baseline (revision ${revision}).`,
        };
        continue;
      }

      // Approved: freeze approved baseline snapshot
      await freezeApprovedBaselineStep(caseId, revision);
      break;
    }

    // 3. Obtain GitHub Pull Request URL (mandatory at this stage)
    let prUrl: string | undefined = undefined;
    while (!prUrl) {
      await updateCaseStageStep(caseId, "awaiting_pull_request", {
        note: "Baseline approved. Awaiting GitHub pull request URL.",
      });

      yield {
        stage: "awaiting_pull_request",
        status: "awaiting_pr",
        message: "Baseline approved. Please provide a public GitHub pull request URL.",
      };

      const prResponse = await ctx.ask({
        prompt:
          "The assurance baseline has been approved. Please provide the public GitHub pull request URL to begin verification (e.g. https://github.com/owner/repo/pull/1):",
        display: "text",
        allowFreeform: true,
      });

      const extracted = extractPrUrl(prResponse.text) || extractPrUrl(prResponse.optionId);
      if (extracted) {
        prUrl = extracted;
      } else if (prResponse.text?.trim().startsWith("http")) {
        prUrl = prResponse.text.trim();
      }
    }

    // 4. Verification & Remediation Loop
    let attempt = 1;
    while (attempt <= 3) {
      yield {
        stage: "verifying",
        status: "active",
        attempt,
        pullRequestUrl: prUrl,
        message: `Auditing pull request (Attempt ${attempt} of 3)...`,
      };

      await updateCaseStageStep(caseId, "verifying", {
        attempt,
        pullRequestUrl: prUrl,
        note: `Verification attempt ${attempt} started for ${prUrl}.`,
      });

      const auditJson = await ctx.agent({
        key: `verify-attempt-${attempt}`,
        target: "verifier",
        message: JSON.stringify({
          task: "verify",
          pullRequestUrl: prUrl,
          attempt,
        }),
      });

      const auditResult = verifierResultSchema.parse(auditJson);

      if (auditResult.verdict === "compliant") {
        await updateCaseStageStep(caseId, "approved", {
          verdict: "compliant",
          blockingCount: 0,
          findings: auditResult.findings,
          note: `Pull request passed all governance controls on attempt ${attempt}.`,
        });

        yield {
          stage: "approved",
          status: "completed",
          attempt,
          findings: auditResult.findings,
          message: "Governance release approved. Zero blocking findings.",
        };

        return {
          status: "approved",
          caseId,
          attempts: attempt,
          verdict: "compliant",
          summary: auditResult.summary,
        };
      }

      if (attempt >= 3) {
        await updateCaseStageStep(caseId, "failed", {
          verdict: "non_compliant",
          blockingCount: auditResult.blockingCount,
          findings: auditResult.findings,
          note: "Maximum verification attempts (3) exhausted with remaining blocking findings.",
        });

        yield {
          stage: "failed",
          status: "failed",
          attempt,
          findings: auditResult.findings,
          message: `Governance release rejected: ${auditResult.blockingCount} blocking finding(s) remain after 3 attempts.`,
        };

        return {
          status: "failed",
          caseId,
          attempts: 3,
          verdict: "non_compliant",
          summary: auditResult.summary,
        };
      }

      // Non-compliant: enter remediation
      await updateCaseStageStep(caseId, "remediation", {
        attempt,
        verdict: "non_compliant",
        blockingCount: auditResult.blockingCount,
        findings: auditResult.findings,
        note: `Attempt ${attempt} found ${auditResult.blockingCount} blocking controls.`,
      });

      yield {
        stage: "remediation",
        status: "awaiting_fix",
        attempt,
        findings: auditResult.findings,
        message: `Attempt ${attempt} failed with ${auditResult.blockingCount} blocking finding(s). Awaiting developer remediation.`,
      };

      const remediationAction = await ctx.ask({
        prompt: `Verification attempt ${attempt} identified ${auditResult.blockingCount} non-compliant control(s).\n\nSummary:\n${auditResult.summary}\n\nPlease push remediation commits to the pull request branch. When ready, select Re-verify to proceed with attempt ${attempt + 1} of 3:`,
        display: "select",
        options: [
          { id: "reverify", label: "Re-verify pull request", style: "primary" },
          { id: "cancel", label: "Cancel change", style: "danger" },
        ],
        allowFreeform: true,
      });

      const updatedPr = extractPrUrl(remediationAction.text) || extractPrUrl(remediationAction.optionId);
      if (updatedPr) {
        prUrl = updatedPr;
      }

      if (remediationAction.optionId === "cancel") {
        await updateCaseStageStep(caseId, "cancelled", {
          note: "Change cancelled by operator during remediation.",
        });

        yield {
          stage: "cancelled",
          status: "cancelled",
          attempt,
          message: "Change cancelled by operator during remediation.",
        };

        return {
          status: "cancelled",
          caseId,
          attempts: attempt,
          verdict: "non_compliant",
          summary: "Change cancelled by operator during remediation.",
        };
      }

      attempt += 1;
    }

    return {
      status: "failed",
      caseId,
      attempts: 3,
      verdict: "non_compliant",
      summary: "Maximum verification attempts exhausted.",
    };
  },
});
