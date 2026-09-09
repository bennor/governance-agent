import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_TRANSITIONS,
  InvalidStateTransitionError,
  createInitialManifest,
  isAllowedTransition,
  transitionCase,
} from "../../agent/lib/governance/state-machine.ts";
import type { GovernanceIntake } from "../../agent/lib/governance/schemas.ts";

const sampleIntake: GovernanceIntake = {
  title: "Customer Feedback API",
  summary: "Add feedback endpoint with validation",
  technicalScope: "Next.js App router with Zod validation",
  dataClassification: "internal",
  pullRequestUrl: "https://github.com/example/repo/pull/1",
};

test("createInitialManifest sets initial state correctly", () => {
  const manifest = createInitialManifest("case_123", sampleIntake, "2026-09-10T00:00:00.000Z");
  assert.equal(manifest.caseId, "case_123");
  assert.equal(manifest.stage, "intake");
  assert.equal(manifest.status, "active");
  assert.equal(manifest.activeRevision, 1);
  assert.equal(manifest.approvedRevision, null);
  assert.equal(manifest.activeAttempt, null);
  assert.equal(manifest.pullRequestUrl, "https://github.com/example/repo/pull/1");
  assert.equal(manifest.history.length, 1);
  assert.equal(manifest.history[0].stage, "intake");
});

test("isAllowedTransition evaluates allowed and disallowed transitions", () => {
  assert.equal(isAllowedTransition("intake", "drafting"), true);
  assert.equal(isAllowedTransition("drafting", "baseline_review"), true);
  assert.equal(isAllowedTransition("baseline_review", "drafting"), true);
  assert.equal(isAllowedTransition("baseline_review", "awaiting_pull_request"), true);
  assert.equal(isAllowedTransition("baseline_review", "verifying"), true);
  assert.equal(isAllowedTransition("verifying", "remediation"), true);
  assert.equal(isAllowedTransition("remediation", "verifying"), true);
  assert.equal(isAllowedTransition("verifying", "approved"), true);
  assert.equal(isAllowedTransition("verifying", "failed"), true);

  // Disallowed transitions
  assert.equal(isAllowedTransition("intake", "verifying"), false);
  assert.equal(isAllowedTransition("drafting", "approved"), false);
  assert.equal(isAllowedTransition("approved", "drafting"), false);
  assert.equal(isAllowedTransition("failed", "verifying"), false);
});

test("transitionCase executes standard happy path to approved", () => {
  let manifest = createInitialManifest("case_123", sampleIntake);

  // intake -> drafting
  manifest = transitionCase(manifest, "drafting");
  assert.equal(manifest.stage, "drafting");
  assert.equal(manifest.status, "active");
  assert.equal(manifest.activeRevision, 1);

  // drafting -> baseline_review
  manifest = transitionCase(manifest, "baseline_review", {
    documents: [
      { filename: "change-design.md", revision: 1 },
      { filename: "security-and-data-review.md", revision: 1 },
      { filename: "implementation-requirements.md", revision: 1 },
      { filename: "policy-applicability.md", revision: 1 },
    ],
  });
  assert.equal(manifest.stage, "baseline_review");
  assert.equal(manifest.status, "awaiting_approval");
  assert.equal(manifest.documents.length, 4);

  // baseline_review -> verifying (approved baseline)
  manifest = transitionCase(manifest, "verifying", { attempt: 1 });
  assert.equal(manifest.stage, "verifying");
  assert.equal(manifest.status, "active");
  assert.equal(manifest.approvedRevision, 1);
  assert.equal(manifest.activeAttempt, 1);

  // verifying -> approved
  manifest = transitionCase(manifest, "approved", {
    verdict: "compliant",
    blockingCount: 0,
  });
  assert.equal(manifest.stage, "approved");
  assert.equal(manifest.status, "completed");
  assert.equal(manifest.verdict, "compliant");
  assert.equal(manifest.blockingCount, 0);
});

test("transitionCase handles revision loop at baseline review", () => {
  let manifest = createInitialManifest("case_123", sampleIntake);
  manifest = transitionCase(manifest, "drafting");
  manifest = transitionCase(manifest, "baseline_review");

  // Operator requests revision
  manifest = transitionCase(manifest, "drafting", {
    note: "Operator requested rate limiting addition",
  });
  assert.equal(manifest.stage, "drafting");
  assert.equal(manifest.activeRevision, 2);
  assert.equal(manifest.approvedRevision, null);

  // Revision 2 completes and is approved
  manifest = transitionCase(manifest, "baseline_review");
  manifest = transitionCase(manifest, "awaiting_pull_request");
  assert.equal(manifest.stage, "awaiting_pull_request");
  assert.equal(manifest.status, "awaiting_pr");
  assert.equal(manifest.approvedRevision, 2);
});

test("transitionCase handles remediation loop and enforces 3-attempt ceiling", () => {
  let manifest = createInitialManifest("case_123", sampleIntake);
  manifest = transitionCase(manifest, "drafting");
  manifest = transitionCase(manifest, "baseline_review");
  manifest = transitionCase(manifest, "verifying", { attempt: 1 });

  // Attempt 1 fails
  manifest = transitionCase(manifest, "remediation", {
    verdict: "non_compliant",
    blockingCount: 2,
    note: "Missing Zod validation and log scrubbing",
  });
  assert.equal(manifest.stage, "remediation");
  assert.equal(manifest.status, "awaiting_fix");

  // Attempt 2
  manifest = transitionCase(manifest, "verifying", { attempt: 2 });
  assert.equal(manifest.activeAttempt, 2);

  // Attempt 2 fails
  manifest = transitionCase(manifest, "remediation", {
    verdict: "non_compliant",
    blockingCount: 1,
  });

  // Attempt 3
  manifest = transitionCase(manifest, "verifying", { attempt: 3 });
  assert.equal(manifest.activeAttempt, 3);

  // Attempt 3 fails terminal transition
  manifest = transitionCase(manifest, "failed", {
    verdict: "non_compliant",
    blockingCount: 1,
    note: "Max attempts exceeded",
  });
  assert.equal(manifest.stage, "failed");
  assert.equal(manifest.status, "failed");

  // Attempt 4 is rejected by the state machine
  assert.throws(
    () => {
      transitionCase(manifest, "verifying", { attempt: 4 });
    },
    (err: unknown) => err instanceof InvalidStateTransitionError
  );
});

test("transitionCase rejects illegal transitions", () => {
  const manifest = createInitialManifest("case_123", sampleIntake);

  assert.throws(() => {
    transitionCase(manifest, "approved");
  }, InvalidStateTransitionError);

  assert.throws(() => {
    transitionCase(manifest, "verifying");
  }, InvalidStateTransitionError);
});

test("extractPrUrl extracts valid github pr urls and rejects invalid input", async () => {
  const { extractPrUrl } = await import("../../agent/tools/run_governance_case.ts");
  assert.equal(
    extractPrUrl("Here is the PR: https://github.com/my-org/my-repo/pull/42 for review"),
    "https://github.com/my-org/my-repo/pull/42"
  );
  assert.equal(extractPrUrl("No PR here"), undefined);
  assert.equal(extractPrUrl(undefined), undefined);
});
