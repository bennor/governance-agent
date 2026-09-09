"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEveAgent, type EveMessageInputRequest } from "eve/react";
import {
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  Clock,
  RefreshCw,
  FileCode,
} from "lucide-react";
import { PortalNavigation } from "@/app/_components/portal-navigation";
import { WorkflowGraph } from "@/app/_components/workflow-graph";
import { DocumentViewer } from "@/app/_components/document-viewer";
import { AuditFindingsViewer, type AttemptReport } from "@/app/_components/audit-findings-viewer";
import { OperatorControls } from "@/app/_components/operator-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CaseManifest, GovernanceStage, GovernanceStatus } from "@/agent/lib/governance/schemas";

interface CaseWorkspaceProps {
  caseId: string;
  initialManifest: CaseManifest | null;
  initialDocuments: { filename: string; title?: string; content?: string; blobUrl?: string }[];
  initialReports: AttemptReport[];
}

export function CaseWorkspace({
  caseId,
  initialManifest,
  initialDocuments,
  initialReports,
}: CaseWorkspaceProps) {
  const [manifest, setManifest] = useState<CaseManifest | null>(initialManifest);
  const [documents, setDocuments] = useState(initialDocuments);
  const [reports, setReports] = useState<AttemptReport[]>(initialReports);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  // Connect to the active Eve session to listen for streaming events and input requests
  const agent = useEveAgent({
    initialSession: {
      sessionId: caseId,
      streamIndex: 0,
    },
    resume: true,
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  // Find any active pending input request from the agent
  let pendingInputRequest: EveMessageInputRequest | undefined;
  for (const message of agent.data.messages) {
    for (const part of message.parts) {
      if (part.type === "dynamic-tool" && part.toolMetadata?.eve?.inputRequest) {
        if (!part.toolMetadata.eve.inputResponse) {
          pendingInputRequest = part.toolMetadata.eve.inputRequest;
        }
      }
    }
  }

  const fetchLatestManifest = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.manifest) {
          setManifest(data.manifest);
        }
        if (data.documents) {
          setDocuments(data.documents);
        }
        if (data.reports) {
          setReports(data.reports);
        }
      }
    } catch (err) {
      console.warn("Could not refresh case manifest:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Poll for updates while busy or when agent settles
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isBusy || manifest?.stage === "drafting" || manifest?.stage === "verifying") {
      interval = setInterval(() => {
        void fetchLatestManifest();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBusy, manifest?.stage]);

  // Handle human responses (approvals, PR submission, reverify)
  const handleOperatorAction = async (action: { optionId?: string; text?: string }) => {
    setIsActionPending(true);
    try {
      if (pendingInputRequest && "requestId" in pendingInputRequest) {
        await agent.respond([
          {
            requestId: pendingInputRequest.requestId,
            optionId: action.optionId,
            text: action.text,
          },
        ]);
        // Fast refresh followed by delayed refresh to catch asynchronous state persistence
        void fetchLatestManifest();
        setTimeout(() => void fetchLatestManifest(), 1000);
        setTimeout(() => void fetchLatestManifest(), 2500);
        return;
      }

      // Fallback: send as direct message to session
      const textMsg =
        action.text ||
        (action.optionId === "approve"
          ? "Approve"
          : action.optionId === "reverify"
          ? "Re-verify"
          : "Cancel");
      await agent.send(textMsg);
      void fetchLatestManifest();
      setTimeout(() => void fetchLatestManifest(), 1000);
      setTimeout(() => void fetchLatestManifest(), 2500);
    } finally {
      setIsActionPending(false);
    }
  };

  const stage: GovernanceStage = manifest?.stage || "intake";
  const status: GovernanceStatus = manifest?.status || "active";
  const title = manifest?.title || `Case ${caseId.slice(0, 12)}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PortalNavigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Breadcrumb & Case Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="size-3" />
                <span>All Cases</span>
              </Link>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-xs font-mono text-muted-foreground">{caseId}</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <Badge
                variant={
                  stage === "approved"
                    ? "default"
                    : stage === "failed" || stage === "cancelled"
                    ? "destructive"
                    : "secondary"
                }
              >
                {stage.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLatestManifest}
              disabled={isRefreshing}
              className="h-8 gap-1.5 text-xs"
              title="Refresh case state"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Link href={`/chat/${encodeURIComponent(caseId)}`}>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <MessageSquare className="size-3.5" />
                <span>Chat Transcript</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Workflow React Flow Graph */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lifecycle State Machine
            </span>
            <span className="text-xs text-muted-foreground">
              Deterministic Stage-Gate Progress
            </span>
          </div>

          <WorkflowGraph
            currentStage={stage}
            currentStatus={status}
            activeRevision={manifest?.activeRevision ?? 1}
            activeAttempt={manifest?.activeAttempt ?? null}
            blockingCount={manifest?.blockingCount ?? null}
            prUrl={manifest?.pullRequestUrl ?? null}
          />
        </div>

        {/* Operator Action Bar */}
        <OperatorControls
          caseId={caseId}
          stage={stage}
          status={status}
          pendingInputRequest={pendingInputRequest}
          activeRevision={manifest?.activeRevision ?? 1}
          activeAttempt={manifest?.activeAttempt ?? null}
          blockingCount={manifest?.blockingCount ?? null}
          onRespond={handleOperatorAction}
          isSubmitting={isBusy || isActionPending}
        />

        {/* Dual Workspace Panel: Baseline Documents & Audit Findings */}
        <Tabs defaultValue="documents" className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="documents" className="text-xs gap-1.5">
                <span>Assurance Baseline</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">
                  {documents.length} docs
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="findings" className="text-xs gap-1.5">
                <span>Verification Audits</span>
                {reports.length > 0 ? (
                  <Badge
                    variant={reports[reports.length - 1].verdict === "compliant" ? "default" : "destructive"}
                    className="text-[10px] h-4 px-1"
                  >
                    {reports.length} {reports.length === 1 ? "audit" : "audits"}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="manifest" className="text-xs gap-1.5">
                <span>Case History</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="documents" className="m-0">
            <DocumentViewer
              caseId={caseId}
              documents={documents}
              activeRevision={manifest?.activeRevision ?? 1}
            />
          </TabsContent>

          <TabsContent value="findings" className="m-0">
            <AuditFindingsViewer
              reports={reports}
              activeAttempt={manifest?.activeAttempt ?? null}
            />
          </TabsContent>

          <TabsContent value="manifest" className="m-0">
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-semibold text-sm">Case Audit Log & History</h3>
              {manifest?.history && manifest.history.length > 0 ? (
                <div className="space-y-3">
                  {manifest.history.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3 border-l-2 border-border pl-4 py-1 text-xs">
                      <div className="size-2 rounded-full bg-primary mt-1 -ml-[21px]" />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold uppercase tracking-wider text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {entry.stage}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {entry.note ? <p className="text-muted-foreground">{entry.note}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No history events recorded.</p>
              )}

              <div className="pt-4 border-t border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Raw Manifest JSON:
                </span>
                <pre className="font-mono text-[11px] bg-muted/60 p-4 rounded-lg mt-2 overflow-x-auto max-h-72">
                  {JSON.stringify(manifest, null, 2)}
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
