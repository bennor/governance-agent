import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCaseId,
  getApprovedBaselineDocumentPath,
  getBaselineDocumentPath,
  getCaseBlobKey,
  getVerificationReportPath,
  getVerificationResultPath,
  sanitizeStoragePath,
  STANDARD_BASELINE_DOCUMENTS,
} from "../../agent/lib/documents/storage.ts";
import { caseManifestSchema, type CaseManifest } from "../../agent/lib/governance/schemas.ts";

test("sanitizeStoragePath strips leading slashes, path traversal, and empty segments", () => {
  assert.equal(sanitizeStoragePath("/change-design.md"), "change-design.md");
  assert.equal(sanitizeStoragePath("///sub/path/file.md"), "sub/path/file.md");
  assert.equal(sanitizeStoragePath("../etc/passwd"), "etc/passwd");
  assert.equal(sanitizeStoragePath("baseline/../../file.md"), "baseline/file.md");
  assert.equal(sanitizeStoragePath("baseline\\revision-1\\file.md"), "baseline/revision-1/file.md");
});

test("path derivation helpers construct correct keys", () => {
  const caseId = "session_abc123";

  assert.equal(
    getCaseBlobKey(caseId, "change-design.md"),
    "governance-demo/runs/session_abc123/change-design.md"
  );
  assert.equal(
    getCaseBlobKey(caseId, "/nested/report.md"),
    "governance-demo/runs/session_abc123/nested/report.md"
  );
  assert.equal(
    getBaselineDocumentPath(1, "change-design.md"),
    "baseline/revision-1/change-design.md"
  );
  assert.equal(
    getBaselineDocumentPath(2, "security-and-data-review.md"),
    "baseline/revision-2/security-and-data-review.md"
  );
  assert.equal(
    getApprovedBaselineDocumentPath("implementation-requirements.md"),
    "baseline/approved/implementation-requirements.md"
  );
  assert.equal(
    getVerificationReportPath(1),
    "verification/attempt-1/verification-report-attempt-1.md"
  );
  assert.equal(
    getVerificationResultPath(2),
    "verification/attempt-2/result.json"
  );
});

test("STANDARD_BASELINE_DOCUMENTS contains all four required artefacts", () => {
  assert.equal(STANDARD_BASELINE_DOCUMENTS.length, 4);
  assert.ok(STANDARD_BASELINE_DOCUMENTS.includes("change-design.md"));
  assert.ok(STANDARD_BASELINE_DOCUMENTS.includes("security-and-data-review.md"));
  assert.ok(STANDARD_BASELINE_DOCUMENTS.includes("implementation-requirements.md"));
  assert.ok(STANDARD_BASELINE_DOCUMENTS.includes("policy-applicability.md"));
});

test("extractCaseId extracts root or parent or current session ID", () => {
  // Direct root session
  assert.equal(extractCaseId({ session: { id: "sess_root" } }), "sess_root");

  // Child with parent sessionId
  assert.equal(
    extractCaseId({
      session: {
        id: "sess_child",
        parent: { sessionId: "sess_parent" },
      },
    }),
    "sess_parent"
  );

  // Deep child with rootSessionId
  assert.equal(
    extractCaseId({
      session: {
        id: "sess_child2",
        parent: {
          sessionId: "sess_sub",
          rootSessionId: "sess_grandparent",
        },
      },
    }),
    "sess_grandparent"
  );
});

test("manifest serialization and schema validation work symmetrically", () => {
  const manifest: CaseManifest = {
    caseId: "case_999",
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T01:00:00.000Z",
    title: "Test Feature",
    intake: {
      title: "Test Feature",
      summary: "Sample summary",
      technicalScope: "Sample scope",
      dataClassification: "pii",
      pullRequestUrl: "https://github.com/org/repo/pull/42",
    },
    stage: "baseline_review",
    status: "awaiting_approval",
    activeRevision: 1,
    approvedRevision: null,
    activeAttempt: null,
    pullRequestUrl: "https://github.com/org/repo/pull/42",
    verdict: null,
    blockingCount: null,
    documents: [
      {
        filename: "change-design.md",
        revision: 1,
        blobUrl: "https://blob.example.com/change-design.md",
      },
    ],
    history: [
      {
        stage: "intake",
        timestamp: "2026-09-10T00:00:00.000Z",
        note: "Created",
      },
    ],
  };

  const serialized = JSON.stringify(manifest);
  const parsed = JSON.parse(serialized);
  const validation = caseManifestSchema.safeParse(parsed);

  assert.equal(validation.success, true);
  if (validation.success) {
    assert.equal(validation.data.caseId, "case_999");
    assert.equal(validation.data.stage, "baseline_review");
    assert.equal(validation.data.intake.dataClassification, "pii");
  }
});
