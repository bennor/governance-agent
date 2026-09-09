import { get, put, BlobNotFoundError } from "@vercel/blob";

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
}

export interface SaveVerificationReportResult extends SaveCaseDocumentResult {
  filename: string;
}

/**
 * Derives the Vercel Blob storage path for a case document based on the root session ID.
 */
export function getCaseBlobKey(caseId: string, filename: string): string {
  const sanitizedFilename = filename.replace(/^\/+/, "");
  return `governance-demo/runs/${caseId}/${sanitizedFilename}`;
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
 * Returns the UTF-8 text content, or null if the document does not exist.
 */
export async function readCaseDocument(
  caseId: string,
  filename: string,
): Promise<string | null> {
  const pathname = getCaseBlobKey(caseId, filename);

  try {
    const result = await get(pathname, { access: "public" });
    if (!result || !result.stream) {
      return null;
    }

    return await new Response(result.stream).text();
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    // Handle 404 or other network fetch issues gracefully
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * Saves a versioned verification audit report to Vercel Blob.
 */
export async function saveVerificationReport({
  caseId,
  attempt,
  content,
}: SaveVerificationReportOptions): Promise<SaveVerificationReportResult> {
  const filename = `verification-report-attempt-${attempt}.md`;
  const saved = await saveCaseDocument({
    caseId,
    filename,
    content,
    contentType: "text/markdown; charset=utf-8",
  });

  return {
    ...saved,
    filename,
  };
}
