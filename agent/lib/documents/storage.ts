import { get, put, list, BlobNotFoundError } from "@vercel/blob";
import { caseManifestSchema, type CaseManifest } from "../governance/schemas.ts";

export const STANDARD_BASELINE_DOCUMENTS = [
  "change-design.md",
  "security-and-data-review.md",
  "implementation-requirements.md",
  "policy-applicability.md",
] as const;

export interface SaveCaseDocumentOptions {
  caseId: string;
  filename: string;
  content: string;
  contentType?: string;
}

export interface SaveCaseDocumentResult {
  url: string;
  pathname: string;
}

export interface SaveVerificationReportOptions {
  caseId: string;
  attempt: number;
  content: string;
  result?: unknown;
}

export interface SaveVerificationReportResult extends SaveCaseDocumentResult {
  filename: string;
  resultUrl?: string;
}

/**
 * Sanitises storage subpaths to prevent path traversal and remove leading slashes.
 */
export function sanitizeStoragePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .join("/");
}

/**
 * Derives the Vercel Blob storage path for a case document based on the root session ID.
 */
export function getCaseBlobKey(caseId: string, filename: string): string {
  const sanitizedFilename = sanitizeStoragePath(filename);
  return `governance-demo/runs/${caseId}/${sanitizedFilename}`;
}

export function getBaselineDocumentPath(revision: number, filename: string): string {
  const sanitized = sanitizeStoragePath(filename);
  return `baseline/revision-${revision}/${sanitized}`;
}

export function getApprovedBaselineDocumentPath(filename: string): string {
  const sanitized = sanitizeStoragePath(filename);
  return `baseline/approved/${sanitized}`;
}

export function getVerificationReportPath(attempt: number): string {
  return `verification/attempt-${attempt}/verification-report-attempt-${attempt}.md`;
}

export function getVerificationResultPath(attempt: number): string {
  return `verification/attempt-${attempt}/result.json`;
}

/**
 * Extracts the durable case identifier from an Eve runtime context.
 * The case ID always resolves to the root Eve session ID.
 */
export function extractCaseId(ctx: {
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

/**
 * Saves a case document into Vercel Blob with public access and no random suffix.
 */
export async function saveCaseDocument({
  caseId,
  filename,
  content,
  contentType = "text/markdown; charset=utf-8",
}: SaveCaseDocumentOptions): Promise<SaveCaseDocumentResult> {
  const pathname = getCaseBlobKey(caseId, filename);
  const blob = await put(pathname, content, {
    access: "public",
    addRandomSuffix: false,
    contentType,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Reads a case document from Vercel Blob.
 * Supports fallback paths for backward compatibility between Phase 1 and Phase 2.
 */
export async function readCaseDocument(
  caseId: string,
  filename: string
): Promise<string | null> {
  const primaryPath = getCaseBlobKey(caseId, filename);

  const candidatePaths = [primaryPath];

  // If unversioned filename was requested (e.g. implementation-requirements.md),
  // check approved baseline snapshot first, then revision-1 as fallbacks
  if (!filename.includes("/")) {
    candidatePaths.push(getCaseBlobKey(caseId, getApprovedBaselineDocumentPath(filename)));
    candidatePaths.push(getCaseBlobKey(caseId, getBaselineDocumentPath(1, filename)));
  }

  for (const pathname of candidatePaths) {
    try {
      const result = await get(pathname, { access: "public" });
      if (result && result.stream) {
        return await new Response(result.stream).text();
      }
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        continue;
      }
      if (error instanceof Error && error.message.includes("404")) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

/**
 * Saves a versioned revision of a baseline document.
 * Also mirrors to the unversioned root filename for Phase 1 compatibility.
 */
export async function saveCaseDocumentVersion(
  caseId: string,
  revision: number,
  filename: string,
  content: string
): Promise<SaveCaseDocumentResult> {
  const versionedPath = getBaselineDocumentPath(revision, filename);
  const result = await saveCaseDocument({
    caseId,
    filename: versionedPath,
    content,
    contentType: "text/markdown; charset=utf-8",
  });

  // Mirror to root filename so unversioned Phase 1 readers can find it
  await saveCaseDocument({
    caseId,
    filename,
    content,
    contentType: "text/markdown; charset=utf-8",
  });

  return result;
}

/**
 * Freezes the approved baseline revision into the approved baseline snapshot folder.
 */
export async function freezeApprovedBaseline(
  caseId: string,
  revision: number
): Promise<void> {
  for (const filename of STANDARD_BASELINE_DOCUMENTS) {
    const versionedPath = getBaselineDocumentPath(revision, filename);
    const content = await readCaseDocument(caseId, versionedPath);
    if (content) {
      const approvedPath = getApprovedBaselineDocumentPath(filename);
      await saveCaseDocument({
        caseId,
        filename: approvedPath,
        content,
        contentType: "text/markdown; charset=utf-8",
      });
      // Also ensure root copy has the approved content
      await saveCaseDocument({
        caseId,
        filename,
        content,
        contentType: "text/markdown; charset=utf-8",
      });
    }
  }
}

/**
 * Saves a case manifest (case.json) into Blob storage.
 */
export async function saveCaseManifest(
  caseId: string,
  manifest: CaseManifest
): Promise<SaveCaseDocumentResult> {
  const content = JSON.stringify(manifest, null, 2);
  return await saveCaseDocument({
    caseId,
    filename: "case.json",
    content,
    contentType: "application/json; charset=utf-8",
  });
}

/**
 * Reads and parses the case manifest (case.json) from Blob storage.
 */
export async function readCaseManifest(
  caseId: string
): Promise<CaseManifest | null> {
  const raw = await readCaseDocument(caseId, "case.json");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const validated = caseManifestSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn(`[storage] Invalid case manifest schema for case ${caseId}:`, validated.error);
      return null;
    }
    return validated.data;
  } catch (error) {
    console.error(`[storage] Failed to parse case manifest JSON for case ${caseId}:`, error);
    return null;
  }
}

/**
 * Lists all case manifests across Blob storage.
 */
export async function listCaseManifests(): Promise<CaseManifest[]> {
  try {
    const response = await list({
      prefix: "governance-demo/runs/",
    });

    const manifestBlobs = response.blobs.filter((b) => b.pathname.endsWith("/case.json"));

    const manifests: CaseManifest[] = [];
    for (const blob of manifestBlobs) {
      try {
        const res = await get(blob.pathname, { access: "public" });
        if (res && res.stream) {
          const text = await new Response(res.stream).text();
          const parsed = JSON.parse(text);
          const validated = caseManifestSchema.safeParse(parsed);
          if (validated.success) {
            manifests.push(validated.data);
          }
        }
      } catch (err) {
        console.warn(`[storage] Could not load manifest from ${blob.pathname}:`, err);
      }
    }

    // Sort newest first by updatedAt
    manifests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return manifests;
  } catch (error) {
    console.warn("[storage] listCaseManifests failed or no token configured:", error);
    return [];
  }
}

/**
 * Saves a versioned verification audit report to Vercel Blob.
 * Writes to attempt-specific path and mirrors to root for Phase 1 compatibility.
 */
export async function saveVerificationReport({
  caseId,
  attempt,
  content,
  result,
}: SaveVerificationReportOptions): Promise<SaveVerificationReportResult> {
  const filename = `verification-report-attempt-${attempt}.md`;
  const versionedReportPath = getVerificationReportPath(attempt);

  // Save versioned report
  const savedReport = await saveCaseDocument({
    caseId,
    filename: versionedReportPath,
    content,
    contentType: "text/markdown; charset=utf-8",
  });

  // Mirror to root filename for Phase 1 backward compatibility
  await saveCaseDocument({
    caseId,
    filename,
    content,
    contentType: "text/markdown; charset=utf-8",
  });

  let resultUrl: string | undefined;
  if (result !== undefined) {
    const versionedResultPath = getVerificationResultPath(attempt);
    const savedResult = await saveCaseDocument({
      caseId,
      filename: versionedResultPath,
      content: JSON.stringify(result, null, 2),
      contentType: "application/json; charset=utf-8",
    });
    resultUrl = savedResult.url;
  }

  return {
    ...savedReport,
    filename,
    resultUrl,
  };
}
