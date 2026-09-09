import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
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

// In-memory cache for fast and reliable reads in stateless/serverless runtimes
const inMemoryStore = new Map<string, string>();

/**
 * Returns a writable directory for local caching or fallback.
 * Uses /tmp in serverless environments (e.g. Vercel) where /var/task is read-only.
 */
export function getSafeStorageDir(caseId?: string): string {
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.cwd().startsWith("/var/task");

  const baseDir = isServerless
    ? path.join(os.tmpdir(), "governance-cases")
    : path.resolve(process.cwd(), "agent/sandbox/workspace/cases");

  return caseId ? path.join(baseDir, caseId) : baseDir;
}

/**
 * Sanitises storage subpaths to prevent path traversal and remove leading slashes.
 */
export function sanitizeStoragePath(storagePath: string): string {
  return storagePath
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
 * Automatically falls back to /tmp/governance-cases and in-memory store if Blob fails.
 */
export async function saveCaseDocument({
  caseId,
  filename,
  content,
  contentType = "text/markdown; charset=utf-8",
}: SaveCaseDocumentOptions): Promise<SaveCaseDocumentResult> {
  const pathname = getCaseBlobKey(caseId, filename);

  // 1. Keep in memory store for guaranteed same-runtime lookup
  inMemoryStore.set(pathname, content);

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  // 2. Try Vercel Blob
  try {
    const blob = await put(pathname, content, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: token || undefined,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
    };
  } catch (error) {
    console.warn(
      `[storage] Vercel Blob put skipped or failed for ${pathname} (token: ${Boolean(token)}):`,
      error instanceof Error ? error.message : String(error)
    );
  }

  // 3. Fallback: write to safe directory (/tmp in serverless, cases directory in local dev)
  try {
    const targetDir = getSafeStorageDir(caseId);
    const targetFilePath = path.join(targetDir, filename);
    await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
    await fs.writeFile(targetFilePath, content, "utf8");
  } catch (fsError) {
    console.warn(
      `[storage] Safe filesystem write skipped for ${filename}:`,
      fsError instanceof Error ? fsError.message : String(fsError)
    );
  }

  return {
    url: pathname,
    pathname,
  };
}

/**
 * Reads a case document from Vercel Blob, falling back to memory and safe filesystem.
 */
export async function readCaseDocument(
  caseId: string,
  filename: string
): Promise<string | null> {
  const primaryPath = getCaseBlobKey(caseId, filename);
  const candidateBlobPaths = [primaryPath];

  if (!filename.includes("/")) {
    candidateBlobPaths.push(getCaseBlobKey(caseId, getApprovedBaselineDocumentPath(filename)));
    candidateBlobPaths.push(getCaseBlobKey(caseId, getBaselineDocumentPath(1, filename)));
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  // 1. Try Blob storage
  for (const pathname of candidateBlobPaths) {
    try {
      const result = await get(pathname, { access: "public", token: token || undefined });
      if (result && result.stream) {
        return await new Response(result.stream).text();
      }
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        continue;
      }
      if (
        error instanceof Error &&
        (error.message.includes("404") || error.message.includes("No blob credentials"))
      ) {
        continue;
      }
      break;
    }
  }

  // 2. Check in-memory store
  for (const pathname of candidateBlobPaths) {
    const cached = inMemoryStore.get(pathname);
    if (typeof cached === "string" && cached.length > 0) {
      return cached;
    }
  }

  // 3. Try safe filesystem fallback
  const candidateLocalFilenames = [filename];
  if (!filename.includes("/")) {
    candidateLocalFilenames.push(getApprovedBaselineDocumentPath(filename));
    candidateLocalFilenames.push(getBaselineDocumentPath(1, filename));
  }

  const searchDirs = [
    getSafeStorageDir(caseId),
    path.join(os.tmpdir(), "governance-cases", caseId),
  ];

  for (const dir of searchDirs) {
    for (const localName of candidateLocalFilenames) {
      try {
        const localPath = path.join(dir, localName);
        const content = await fs.readFile(localPath, "utf8");
        if (content) {
          return content;
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
}

/**
 * Saves a versioned revision of a baseline document.
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
 * Lists all case manifests across Blob storage and safe local workspace.
 */
export async function listCaseManifests(): Promise<CaseManifest[]> {
  const manifestMap = new Map<string, CaseManifest>();
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  // 1. Check Blob storage
  try {
    const response = await list({
      prefix: "governance-demo/runs/",
      token: token || undefined,
    });

    const manifestBlobs = response.blobs.filter((b) => b.pathname.endsWith("/case.json"));

    for (const blob of manifestBlobs) {
      try {
        const res = await get(blob.pathname, { access: "public", token: token || undefined });
        if (res && res.stream) {
          const text = await new Response(res.stream).text();
          const parsed = JSON.parse(text);
          const validated = caseManifestSchema.safeParse(parsed);
          if (validated.success) {
            manifestMap.set(validated.data.caseId, validated.data);
          }
        }
      } catch (err) {
        console.warn(`[storage] Could not load manifest from ${blob.pathname}:`, err);
      }
    }
  } catch (error) {
    // Continue
  }

  // 2. Check in-memory store
  for (const [key, raw] of inMemoryStore.entries()) {
    if (key.endsWith("/case.json")) {
      try {
        const parsed = JSON.parse(raw);
        const validated = caseManifestSchema.safeParse(parsed);
        if (validated.success && !manifestMap.has(validated.data.caseId)) {
          manifestMap.set(validated.data.caseId, validated.data);
        }
      } catch {
        // Ignore
      }
    }
  }

  // 3. Check local directory only in local development
  if (!process.env.VERCEL) {
    try {
      const localBaseDir = path.resolve(process.cwd(), "agent/sandbox/workspace/cases");
      const entries = await fs.readdir(localBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const caseJsonPath = path.join(localBaseDir, entry.name, "case.json");
            const content = await fs.readFile(caseJsonPath, "utf8");
            const parsed = JSON.parse(content);
            const validated = caseManifestSchema.safeParse(parsed);
            if (validated.success && !manifestMap.has(validated.data.caseId)) {
              manifestMap.set(validated.data.caseId, validated.data);
            }
          } catch {
            // No case.json in this directory
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  const manifests = Array.from(manifestMap.values());
  manifests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return manifests;
}

/**
 * Saves a versioned verification audit report to Vercel Blob.
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
