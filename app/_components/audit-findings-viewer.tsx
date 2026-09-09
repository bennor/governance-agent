"use client";

import { useState } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileCode2,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditFinding } from "@/agent/lib/governance/schemas";

export interface AttemptReport {
  attempt: number;
  verdict: "compliant" | "non_compliant" | "unable_to_verify";
  summary: string;
  pullRequestUrl?: string;
  blockingCount: number;
  findings: AuditFinding[];
  reportContent?: string;
  blobUrl?: string;
}

interface AuditFindingsViewerProps {
  reports: AttemptReport[];
  activeAttempt?: number | null;
}

export function AuditFindingsViewer({ reports, activeAttempt = 1 }: AuditFindingsViewerProps) {
  const [selectedAttempt, setSelectedAttempt] = useState<number>(
    reports.length > 0 ? reports[reports.length - 1].attempt : 1
  );
  const [viewMode, setViewMode] = useState<"findings" | "report">("findings");

  const currentReport = reports.find((r) => r.attempt === selectedAttempt);

  if (!currentReport && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center text-muted-foreground gap-3">
        <FileCode2 className="size-8 text-muted-foreground/60" />
        <div>
          <p className="font-semibold text-sm text-foreground">No Verification Audits Yet</p>
          <p className="text-xs mt-1 max-w-sm">
            Audits will execute once the assurance baseline is approved and a public GitHub pull request is supplied.
          </p>
        </div>
      </div>
    );
  }

  const report = currentReport ?? reports[0];

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden h-[600px]">
      {/* Header with Attempt Selector & Verdict */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5 gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-xs tracking-tight">Audit Attempts:</span>
          <div className="flex items-center gap-1">
            {reports.map((r) => (
              <Button
                key={r.attempt}
                size="sm"
                variant={r.attempt === selectedAttempt ? "default" : "outline"}
                onClick={() => setSelectedAttempt(r.attempt)}
                className="h-7 text-xs px-2.5"
              >
                Attempt {r.attempt}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              report.verdict === "compliant"
                ? "default"
                : report.verdict === "non_compliant"
                ? "destructive"
                : "secondary"
            }
            className="text-xs font-semibold"
          >
            {report.verdict === "compliant"
              ? "Compliant (0 Blockers)"
              : report.verdict === "non_compliant"
              ? `Non-Compliant (${report.blockingCount} Blocker${report.blockingCount === 1 ? "" : "s"})`
              : "Unable to Verify"}
          </Badge>

          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("findings")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === "findings" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Structured Controls
            </button>
            <button
              type="button"
              onClick={() => setViewMode("report")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === "report" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Full Report
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background space-y-4">
        {/* Audit Summary Box */}
        {report.summary ? (
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-xs">
            <span className="font-semibold text-foreground">Verifier Summary:</span>
            <p className="mt-1 text-muted-foreground leading-relaxed">{report.summary}</p>
          </div>
        ) : null}

        {viewMode === "findings" ? (
          <div className="space-y-3">
            {report.findings.map((f, i) => (
              <div
                key={f.controlId || i}
                className={`rounded-lg border p-4 text-xs space-y-2 transition-colors ${
                  f.status === "pass"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : f.status === "fail"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-muted/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {f.status === "pass" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : f.status === "fail" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <HelpCircle className="size-4 text-muted-foreground" />
                    )}
                    <span className="font-mono font-bold">{f.controlId}</span>
                    <span className="font-medium text-foreground">{f.title}</span>
                  </div>

                  <Badge
                    variant={
                      f.status === "pass"
                        ? "default"
                        : f.status === "fail"
                        ? "destructive"
                        : "outline"
                    }
                    className="text-[10px] uppercase font-bold"
                  >
                    {f.status}
                  </Badge>
                </div>

                <div className="space-y-1 text-muted-foreground pt-1 border-t border-border/50">
                  <div>
                    <span className="font-semibold text-foreground">Code Evidence:</span>
                    <p className="font-mono text-[11px] bg-muted/60 rounded px-2 py-1 mt-0.5 whitespace-pre-wrap">
                      {f.evidence}
                    </p>
                  </div>

                  {f.remediation ? (
                    <div className="pt-1">
                      <span className="font-semibold text-destructive">Remediation Required:</span>
                      <p className="text-[11px] text-destructive/90 mt-0.5">{f.remediation}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <article className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed">
            {report.reportContent ? (
              <Streamdown plugins={{ code }}>{report.reportContent}</Streamdown>
            ) : (
              <p className="text-muted-foreground">Verification markdown report not loaded.</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
