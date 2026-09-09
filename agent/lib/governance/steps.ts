import {
  createInitialManifest,
  transitionCase,
  type TransitionContext,
} from "./state-machine.ts";
import {
  freezeApprovedBaseline,
  getBaselineDocumentPath,
  readCaseDocument,
  readCaseManifest,
  saveCaseManifest,
  STANDARD_BASELINE_DOCUMENTS,
} from "../documents/storage.ts";
import type { GovernanceIntake, GovernanceStage } from "./schemas.ts";

export async function initCaseStep(caseId: string, intake: GovernanceIntake) {
  "use step";
  const existing = await readCaseManifest(caseId);
  if (existing) {
    return existing;
  }
  const manifest = createInitialManifest(caseId, intake);
  await saveCaseManifest(caseId, manifest);
  return manifest;
}

export async function updateCaseStageStep(
  caseId: string,
  targetStage: GovernanceStage,
  context: TransitionContext = {}
) {
  "use step";
  const manifest = await readCaseManifest(caseId);
  if (!manifest) {
    throw new Error(`Manifest not found for case: ${caseId}`);
  }
  const nextManifest = transitionCase(manifest, targetStage, context);
  await saveCaseManifest(caseId, nextManifest);
  return nextManifest;
}

export async function verifyBaselineDocumentsStep(caseId: string, revision: number) {
  "use step";
  const missing: string[] = [];
  for (const doc of STANDARD_BASELINE_DOCUMENTS) {
    const versioned = await readCaseDocument(caseId, getBaselineDocumentPath(revision, doc));
    if (!versioned) {
      const rootFallback = await readCaseDocument(caseId, doc);
      if (!rootFallback) {
        missing.push(doc);
      }
    }
  }
  return { ok: missing.length === 0, missing };
}

export async function freezeApprovedBaselineStep(caseId: string, revision: number) {
  "use step";
  await freezeApprovedBaseline(caseId, revision);
}
