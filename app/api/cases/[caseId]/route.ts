import { NextResponse } from "next/server";
import {
  readCaseDocument,
  readCaseManifest,
  STANDARD_BASELINE_DOCUMENTS,
  getBaselineDocumentPath,
  getVerificationReportPath,
  getVerificationResultPath,
} from "@/agent/lib/documents/storage.ts";
import type { AttemptReport } from "@/app/_components/audit-findings-viewer.tsx";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  try {
    const manifest = await readCaseManifest(caseId);
    if (!manifest) {
      return NextResponse.json(
        { error: `Case "${caseId}" not found` },
        { status: 404 }
      );
    }

    // Load baseline documents
    const documents: { filename: string; title?: string; content?: string; blobUrl?: string }[] = [];
    const revision = manifest.activeRevision ?? 1;

    for (const filename of STANDARD_BASELINE_DOCUMENTS) {
      const versionedPath = getBaselineDocumentPath(revision, filename);
      const content =
        (await readCaseDocument(caseId, versionedPath)) ||
        (await readCaseDocument(caseId, filename));
      const docMeta = manifest.documents.find((d) => d.filename === filename);

      if (content) {
        documents.push({
          filename,
          title: docMeta?.title || filename,
          content,
          blobUrl: docMeta?.blobUrl,
        });
      }
    }

    // Load audit reports
    const reports: AttemptReport[] = [];
    const maxAttempt = manifest.activeAttempt ?? 1;

    for (let attempt = 1; attempt <= maxAttempt; attempt++) {
      const reportPath = getVerificationReportPath(attempt);
      const reportContent =
        (await readCaseDocument(caseId, reportPath)) ||
        (await readCaseDocument(caseId, `verification-report-attempt-${attempt}.md`));

      const resultPath = getVerificationResultPath(attempt);
      const resultRaw = await readCaseDocument(caseId, resultPath);

      if (reportContent || resultRaw) {
        let parsedResult: any = null;
        if (resultRaw) {
          try {
            parsedResult = JSON.parse(resultRaw);
          } catch {
            // Ignore JSON parse error
          }
        }

        reports.push({
          attempt,
          verdict:
            parsedResult?.verdict ||
            (attempt === manifest.activeAttempt ? manifest.verdict : "non_compliant") ||
            "non_compliant",
          summary:
            parsedResult?.summary ||
            (reportContent ? reportContent.slice(0, 300) : "Audit completed."),
          pullRequestUrl: manifest.pullRequestUrl || undefined,
          blockingCount:
            parsedResult?.blockingCount !== undefined
              ? parsedResult.blockingCount
              : attempt === manifest.activeAttempt
              ? manifest.blockingCount ?? 0
              : 0,
          findings:
            parsedResult?.findings ||
            (attempt === manifest.activeAttempt ? manifest.findings ?? [] : []),
          reportContent: reportContent || undefined,
        });
      }
    }

    return NextResponse.json(
      { manifest, documents, reports },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(`Failed to fetch case details for ${caseId}:`, error);
    return NextResponse.json(
      { error: "Internal server error fetching case details" },
      { status: 500 }
    );
  }
}
