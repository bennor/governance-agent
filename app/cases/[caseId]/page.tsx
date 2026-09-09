import { notFound } from "next/navigation";
import { CaseWorkspace } from "./case-workspace";
import {
  readCaseDocument,
  readCaseManifest,
  STANDARD_BASELINE_DOCUMENTS,
  getBaselineDocumentPath,
  getVerificationReportPath,
  getVerificationResultPath,
} from "@/agent/lib/documents/storage";
import type { AttemptReport } from "@/app/_components/audit-findings-viewer";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
}: {
  readonly params: Promise<{ readonly caseId: string }>;
}) {
  const { caseId } = await params;

  const manifest = await readCaseManifest(caseId);

  // Load baseline documents if available
  const documents: { filename: string; title?: string; content?: string; blobUrl?: string }[] = [];
  const revision = manifest?.activeRevision ?? 1;

  for (const filename of STANDARD_BASELINE_DOCUMENTS) {
    const versionedPath = getBaselineDocumentPath(revision, filename);
    const content = (await readCaseDocument(caseId, versionedPath)) || (await readCaseDocument(caseId, filename));
    const docMeta = manifest?.documents.find((d) => d.filename === filename);

    if (content) {
      documents.push({
        filename,
        title: docMeta?.title || filename,
        content,
        blobUrl: docMeta?.blobUrl,
      });
    }
  }

  // Load audit reports if available
  const reports: AttemptReport[] = [];
  const maxAttempt = manifest?.activeAttempt ?? 1;

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
          (attempt === manifest?.activeAttempt ? manifest.verdict : "non_compliant") ||
          "non_compliant",
        summary: parsedResult?.summary || (reportContent ? reportContent.slice(0, 300) : "Audit completed."),
        pullRequestUrl: manifest?.pullRequestUrl || undefined,
        blockingCount:
          parsedResult?.blockingCount !== undefined
            ? parsedResult.blockingCount
            : attempt === manifest?.activeAttempt
            ? manifest.blockingCount ?? 0
            : 0,
        findings: parsedResult?.findings || (attempt === manifest?.activeAttempt ? manifest.findings ?? [] : []),
        reportContent: reportContent || undefined,
      });
    }
  }

  return (
    <CaseWorkspace
      caseId={caseId}
      initialManifest={manifest}
      initialDocuments={documents}
      initialReports={reports}
    />
  );
}
