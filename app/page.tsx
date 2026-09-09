import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowRight,
  FolderGit2,
  FileCheck2,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  FileText,
  BookOpen,
} from "lucide-react";
import { PortalNavigation } from "@/app/_components/portal-navigation";
import { listCaseManifests } from "@/agent/lib/documents/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GovernanceStage, GovernanceStatus } from "@/agent/lib/governance/schemas";

export const dynamic = "force-dynamic";

function getStageBadgeVariant(stage: GovernanceStage, status: GovernanceStatus) {
  if (stage === "approved") return "default";
  if (stage === "failed" || stage === "cancelled") return "destructive";
  if (status === "awaiting_approval" || status === "awaiting_pr" || status === "awaiting_fix") {
    return "secondary";
  }
  return "outline";
}

function formatStageLabel(stage: GovernanceStage) {
  switch (stage) {
    case "intake":
      return "Intake";
    case "drafting":
      return "Drafting Baseline";
    case "baseline_review":
      return "Awaiting Baseline Review";
    case "awaiting_pull_request":
      return "Awaiting PR";
    case "verifying":
      return "Auditing PR";
    case "remediation":
      return "Remediation Required";
    case "approved":
      return "Approved Release";
    case "failed":
      return "Verification Failed";
    case "cancelled":
      return "Cancelled";
  }
}

export default async function GovernanceDashboardPage() {
  const cases = await listCaseManifests();

  const totalCases = cases.length;
  const inReviewCount = cases.filter(
    (c) => c.status === "awaiting_approval" || c.stage === "baseline_review"
  ).length;
  const inRemediationCount = cases.filter(
    (c) => c.stage === "remediation" || c.status === "awaiting_fix"
  ).length;
  const compliantCount = cases.filter((c) => c.stage === "approved").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PortalNavigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header & Quick Intake CTA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Governance Cases</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Automated release assurance and policy verification for regulated software delivery.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <MessageSquare className="size-3.5" />
                <span>Conversational Mode (Phase 1)</span>
              </Button>
            </Link>
            <Link href="/cases/new">
              <Button size="sm" className="gap-1.5 text-xs">
                <span>Start Deterministic Case</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Cases
              </CardTitle>
              <FolderGit2 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCases}</div>
              <p className="text-xs text-muted-foreground mt-1">Durable governance records</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Awaiting Review
              </CardTitle>
              <Clock className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{inReviewCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Human-in-the-loop checkpoints</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                In Remediation
              </CardTitle>
              <AlertTriangle className="size-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{inRemediationCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Failing non-compliant controls</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Approved Releases
              </CardTitle>
              <ShieldCheck className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{compliantCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Zero blocking findings</p>
            </CardContent>
          </Card>
        </div>

        {/* Cases Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Active & Historic Releases</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Inspect state progression, baseline documents, and line-level verification reports.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {cases.length} {cases.length === 1 ? "case" : "cases"}
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            {cases.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <FileCheck2 className="size-10 text-muted-foreground/60" />
                <h3 className="font-semibold text-base">No Governance Cases Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Start your first release governance assessment using the structured intake form or conversational chat.
                </p>
                <div className="flex gap-3 mt-2">
                  <Link href="/cases/new">
                    <Button size="sm">New Governance Case</Button>
                  </Link>
                  <Link href="/chat">
                    <Button variant="outline" size="sm">
                      Open Direct Chat
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case ID</TableHead>
                    <TableHead>Feature Title</TableHead>
                    <TableHead>Stage / Status</TableHead>
                    <TableHead>Revision / Attempt</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((item) => (
                    <TableRow key={item.caseId}>
                      <TableCell className="font-mono text-xs font-medium">
                        {item.caseId.slice(0, 16)}...
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-md">
                          {item.intake.summary}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStageBadgeVariant(item.stage, item.status)}>
                          {formatStageLabel(item.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>Rev: {item.activeRevision}</div>
                        {item.activeAttempt ? <div>Attempt: {item.activeAttempt}/3</div> : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}{" "}
                        ({new Date(item.updatedAt).toLocaleDateString()})
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/cases/${item.caseId}`}>
                            <Button size="sm" variant="default" className="h-7 text-xs">
                              Workspace
                            </Button>
                          </Link>
                          <Link href={`/chat/${item.caseId}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" title="Inspect Chat Transcript">
                              <MessageSquare className="size-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Normative Policy Standards Overview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Active Policy Catalog (7 Normative Standards)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: "POL-ENG-001", title: "Software Change Standard", desc: "Acceptance criteria, bounded scope, dependencies, configuration isolation." },
              { id: "POL-SEC-001", title: "Secure Coding Standard", desc: "Input validation (Zod), server-side auth, no secrets, safe error delivery." },
              { id: "POL-TST-001", title: "Testing Standard", desc: "Automated test suites, happy path, negative error cases, regression integrity." },
              { id: "POL-API-001", title: "HTTP API Standard", desc: "Semantic HTTP verbs, explicit status codes, JSON envelopes, stack redaction." },
              { id: "POL-UI-001", title: "Frontend Quality Standard", desc: "Accessible form labels (htmlFor), keyboard focus, feedback states, dual validation." },
              { id: "POL-OPS-001", title: "Observability & Errors", desc: "Structured try/catch, log sanitisation (no PII/tokens), client timeouts." },
              { id: "POL-DAT-001", title: "Data Handling Standard", desc: "Data minimisation, classification, no sensitive fields in console logs." },
            ].map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {p.id}
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
