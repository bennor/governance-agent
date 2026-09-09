import assert from "node:assert/strict";
import test from "node:test";
import {
  saveCaseManifest,
  readCaseManifest,
  listCaseManifests,
  saveCaseDocumentVersion,
  readCaseDocument,
} from "../../agent/lib/documents/storage.ts";
import { createInitialManifest, transitionCase } from "../../agent/lib/governance/state-machine.ts";
import type { GovernanceIntake } from "../../agent/lib/governance/schemas.ts";

test("storage manifest lifecycle works end to end", async () => {
  const caseId = `test_case_${Date.now()}`;
  const intake: GovernanceIntake = {
    title: "Test Intake Feature",
    summary: "API testing summary",
    technicalScope: "Next.js routes and Zod schema",
    dataClassification: "internal",
  };

  let manifest = createInitialManifest(caseId, intake);
  await saveCaseManifest(caseId, manifest);

  const loaded = await readCaseManifest(caseId);
  assert.ok(loaded);
  assert.equal(loaded?.caseId, caseId);
  assert.equal(loaded?.stage, "intake");

  // Update manifest through state transition
  manifest = transitionCase(manifest, "drafting");
  await saveCaseManifest(caseId, manifest);

  const updated = await readCaseManifest(caseId);
  assert.equal(updated?.stage, "drafting");

  // Save versioned document
  await saveCaseDocumentVersion(
    caseId,
    1,
    "change-design.md",
    "# Change Design\n\nTest content."
  );

  const docContent = await readCaseDocument(caseId, "baseline/revision-1/change-design.md");
  assert.ok(docContent);
  assert.match(docContent, /# Change Design/);

  // Root fallback read
  const rootDocContent = await readCaseDocument(caseId, "change-design.md");
  assert.ok(rootDocContent);
  assert.match(rootDocContent, /# Change Design/);
});
