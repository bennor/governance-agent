import type {
  AuditFinding,
  CaseDocument,
  CaseManifest,
  GovernanceIntake,
  GovernanceStage,
  GovernanceStatus,
} from "./schemas";

export const MAX_VERIFICATION_ATTEMPTS = 3;

export const ALLOWED_TRANSITIONS: Record<GovernanceStage, readonly GovernanceStage[]> = {
  intake: ["drafting", "cancelled"],
  drafting: ["baseline_review", "cancelled"],
  baseline_review: ["drafting", "awaiting_pull_request", "verifying", "cancelled"],
  awaiting_pull_request: ["verifying", "cancelled"],
  verifying: ["approved", "remediation", "failed", "cancelled"],
  remediation: ["verifying", "failed", "cancelled"],
  approved: [],
  failed: [],
  cancelled: [],
};

export class InvalidStateTransitionError extends Error {
  readonly fromStage: GovernanceStage;
  readonly toStage: GovernanceStage;

  constructor(fromStage: GovernanceStage, toStage: GovernanceStage, reason?: string) {
    super(
      `Invalid governance state transition from '${fromStage}' to '${toStage}'${reason ? `: ${reason}` : ""}.`
    );
    this.name = "InvalidStateTransitionError";
    this.fromStage = fromStage;
    this.toStage = toStage;
  }
}

export function isAllowedTransition(from: GovernanceStage, to: GovernanceStage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function deriveDefaultStatusForStage(stage: GovernanceStage): GovernanceStatus {
  switch (stage) {
    case "intake":
    case "drafting":
    case "verifying":
      return "active";
    case "baseline_review":
      return "awaiting_approval";
    case "awaiting_pull_request":
      return "awaiting_pr";
    case "remediation":
      return "awaiting_fix";
    case "approved":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

export function createInitialManifest(
  caseId: string,
  intake: GovernanceIntake,
  timestamp: string = new Date().toISOString()
): CaseManifest {
  return {
    caseId,
    createdAt: timestamp,
    updatedAt: timestamp,
    title: intake.title,
    intake,
    stage: "intake",
    status: "active",
    activeRevision: 1,
    approvedRevision: null,
    activeAttempt: null,
    pullRequestUrl: intake.pullRequestUrl ?? null,
    verdict: null,
    blockingCount: null,
    documents: [],
    history: [
      {
        stage: "intake",
        timestamp,
        note: "Case initialised with feature intake.",
      },
    ],
  };
}

export interface TransitionContext {
  revision?: number;
  attempt?: number;
  pullRequestUrl?: string | null;
  verdict?: "compliant" | "non_compliant" | "unable_to_verify" | null;
  blockingCount?: number | null;
  findings?: AuditFinding[];
  documents?: CaseDocument[];
  note?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  status?: GovernanceStatus;
}

export function transitionCase(
  current: CaseManifest,
  targetStage: GovernanceStage,
  context: TransitionContext = {}
): CaseManifest {
  if (!isAllowedTransition(current.stage, targetStage)) {
    throw new InvalidStateTransitionError(current.stage, targetStage);
  }

  const now = context.timestamp ?? new Date().toISOString();
  const nextStatus = context.status ?? deriveDefaultStatusForStage(targetStage);

  let activeRevision = current.activeRevision;
  let approvedRevision = current.approvedRevision;
  let activeAttempt = current.activeAttempt;

  // Transition-specific business rules
  if (current.stage === "baseline_review" && targetStage === "drafting") {
    // Operator requested revisions: increment revision
    activeRevision = context.revision ?? current.activeRevision + 1;
  } else if (
    current.stage === "baseline_review" &&
    (targetStage === "awaiting_pull_request" || targetStage === "verifying")
  ) {
    // Operator approved the active baseline
    approvedRevision = current.activeRevision;
  }

  if (targetStage === "verifying") {
    const attempt = context.attempt ?? (current.activeAttempt ? current.activeAttempt + 1 : 1);
    if (attempt > MAX_VERIFICATION_ATTEMPTS) {
      throw new InvalidStateTransitionError(
        current.stage,
        targetStage,
        `Maximum verification attempts (${MAX_VERIFICATION_ATTEMPTS}) exceeded`
      );
    }
    activeAttempt = attempt;
  }

  // Merge or update documents if provided
  let documents = current.documents;
  if (context.documents && context.documents.length > 0) {
    const docMap = new Map<string, CaseDocument>();
    for (const doc of current.documents) {
      docMap.set(doc.filename, doc);
    }
    for (const doc of context.documents) {
      docMap.set(doc.filename, doc);
    }
    documents = Array.from(docMap.values());
  }

  const nextManifest: CaseManifest = {
    ...current,
    stage: targetStage,
    status: nextStatus,
    updatedAt: now,
    activeRevision,
    approvedRevision,
    activeAttempt,
    pullRequestUrl: context.pullRequestUrl !== undefined ? context.pullRequestUrl : current.pullRequestUrl,
    verdict: context.verdict !== undefined ? context.verdict : current.verdict,
    blockingCount: context.blockingCount !== undefined ? context.blockingCount : current.blockingCount,
    findings: context.findings !== undefined ? context.findings : current.findings,
    documents,
    history: [
      ...current.history,
      {
        stage: targetStage,
        timestamp: now,
        note: context.note,
        details: context.details,
      },
    ],
  };

  return nextManifest;
}
