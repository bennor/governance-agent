"use client";

import { useState } from "react";
import type { EveMessageInputRequest } from "eve/react";
import {
  CheckCircle2,
  AlertTriangle,
  GitPullRequest,
  RotateCcw,
  XCircle,
  Loader2,
  Send,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { GovernanceStage, GovernanceStatus } from "@/agent/lib/governance/schemas";

interface OperatorControlsProps {
  caseId: string;
  stage: GovernanceStage;
  status: GovernanceStatus;
  pendingInputRequest?: EveMessageInputRequest;
  activeRevision?: number;
  activeAttempt?: number | null;
  blockingCount?: number | null;
  onRespond?: (response: { optionId?: string; text?: string }) => Promise<void>;
  isSubmitting?: boolean;
}

export function OperatorControls({
  caseId,
  stage,
  status,
  pendingInputRequest,
  activeRevision = 1,
  activeAttempt = 1,
  blockingCount,
  onRespond,
  isSubmitting = false,
}: OperatorControlsProps) {
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [prUrlInput, setPrUrlInput] = useState("");
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const busy = isSubmitting || localSubmitting;

  const handleApprove = async () => {
    if (busy || !onRespond) return;
    setLocalSubmitting(true);
    try {
      await onRespond({ optionId: "approve" });
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (busy || !revisionFeedback.trim() || !onRespond) return;
    setLocalSubmitting(true);
    try {
      await onRespond({
        optionId: "revise",
        text: revisionFeedback.trim(),
      });
      setShowRevisionInput(false);
      setRevisionFeedback("");
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (busy || !onRespond) return;
    setLocalSubmitting(true);
    try {
      await onRespond({ optionId: "cancel" });
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handlePrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !prUrlInput.trim() || !onRespond) return;
    setLocalSubmitting(true);
    try {
      await onRespond({ text: prUrlInput.trim() });
      setPrUrlInput("");
    } finally {
      setLocalSubmitting(false);
    }
  };

  const handleReverify = async () => {
    if (busy || !onRespond) return;
    setLocalSubmitting(true);
    try {
      await onRespond({ optionId: "reverify" });
    } finally {
      setLocalSubmitting(false);
    }
  };

  // Determine active action mode directly from pending request or stage fallback
  const isPrPrompt =
    pendingInputRequest?.display === "text" ||
    pendingInputRequest?.prompt?.toLowerCase().includes("pull request") ||
    stage === "awaiting_pull_request" ||
    status === "awaiting_pr";

  const isReviewPrompt =
    !isPrPrompt &&
    (pendingInputRequest?.options?.some((o) => o.id === "approve") ||
      stage === "baseline_review" ||
      status === "awaiting_approval");

  const isRemediationPrompt =
    !isPrPrompt &&
    !isReviewPrompt &&
    (pendingInputRequest?.options?.some((o) => o.id === "reverify") ||
      stage === "remediation" ||
      status === "awaiting_fix");

  // 1. Awaiting Pull Request URL (Check first so an approved baseline immediately requests PR URL)
  if (isPrPrompt) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 sm:p-5 text-card-foreground shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-primary/20 pb-3">
          <GitPullRequest className="size-4 text-primary" />
          <span className="font-semibold text-sm">Action Required: Supply Pull Request URL</span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          The assurance baseline is approved. Provide the public GitHub pull request link to begin automated code auditing.
        </p>

        <form onSubmit={handlePrSubmit} className="flex gap-2">
          <Input
            placeholder="https://github.com/bennor/governance-agent-demo-app/pull/1"
            value={prUrlInput}
            onChange={(e) => setPrUrlInput(e.target.value)}
            disabled={busy}
            className="text-xs bg-background"
            required
          />
          <Button type="submit" size="sm" disabled={busy || !prUrlInput.trim()} className="gap-1.5 h-9 shrink-0">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            <span>Start Audit</span>
          </Button>
        </form>
      </div>
    );
  }

  // 2. Awaiting Baseline Approval
  if (isReviewPrompt) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5 text-card-foreground shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold text-sm">Human-in-the-Loop Gate: Baseline Review</span>
          </div>
          <Badge variant="outline" className="text-xs font-mono border-amber-500/40 text-amber-600 dark:text-amber-400">
            Revision {activeRevision} Ready
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          The four assurance documents have been drafted against normative policy standards. Please inspect the documents in the viewer above, then approve to proceed or request specific revisions.
        </p>

        {showRevisionInput ? (
          <div className="space-y-3 pt-2">
            <Textarea
              placeholder="Specify requirements to update (e.g. Add rate limiting control or require negative test cases)..."
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              disabled={busy}
              rows={3}
              className="text-xs bg-background"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleRequestRevision}
                disabled={busy || !revisionFeedback.trim()}
                className="gap-1.5 text-xs h-8"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                <span>Send Revisions to Drafter</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRevisionInput(false)}
                disabled={busy}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={busy}
                className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                <span>Approve Baseline</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRevisionInput(true)}
                disabled={busy}
                className="gap-1.5 text-xs h-8"
              >
                <RotateCcw className="size-3.5" />
                <span>Request Revisions</span>
              </Button>
            </div>

            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancel}
              disabled={busy}
              className="gap-1.5 text-xs h-8 opacity-80 hover:opacity-100"
            >
              <XCircle className="size-3.5" />
              <span>Cancel Change</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 3. In Remediation
  if (isRemediationPrompt) {
    return (
      <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-4 sm:p-5 text-card-foreground shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-500/20 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-orange-500" />
            <span className="font-semibold text-sm">Remediation Checkpoint: Non-Compliant Controls</span>
          </div>
          <Badge variant="destructive" className="text-xs font-mono">
            {blockingCount || 0} Blocking Finding{blockingCount === 1 ? "" : "s"}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          The code audit identified non-compliant controls. Push fixes to your GitHub branch. Once updated, click Re-verify to execute Attempt {(activeAttempt ?? 1) + 1} of 3.
        </p>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            size="sm"
            onClick={handleReverify}
            disabled={busy}
            className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            <span>Re-verify Pull Request (Attempt {(activeAttempt ?? 1) + 1}/3)</span>
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleCancel}
            disabled={busy}
            className="gap-1.5 text-xs h-8 opacity-80 hover:opacity-100"
          >
            <XCircle className="size-3.5" />
            <span>Abandon Change</span>
          </Button>
        </div>
      </div>
    );
  }

  // 4. Terminal States
  if (stage === "approved") {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5 text-card-foreground shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
              Release Approved for Production
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              All normative controls passed verification on attempt {activeAttempt ?? 1}.
            </p>
          </div>
        </div>

        <a href={`/chat/${encodeURIComponent(caseId)}`} className="text-xs font-medium text-primary underline">
          View Transcript
        </a>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5 text-card-foreground shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <XCircle className="size-6 text-destructive shrink-0" />
          <div>
            <h4 className="font-semibold text-sm text-destructive">Release Verification Failed</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Maximum verification attempts exhausted with remaining non-compliant findings.
            </p>
          </div>
        </div>

        <a href={`/chat/${encodeURIComponent(caseId)}`} className="text-xs font-medium text-destructive underline">
          View Transcript
        </a>
      </div>
    );
  }

  // Active / Busy in drafting or verifying
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>
          {stage === "drafting"
            ? `Specialist Drafter is authoring baseline revision ${activeRevision}...`
            : stage === "verifying"
            ? `Specialist Verifier is auditing pull request (Attempt ${activeAttempt ?? 1}/3)...`
            : "Agent is processing current stage..."}
        </span>
      </div>
      <a
        href={`/chat/${encodeURIComponent(caseId)}`}
        className="text-xs text-primary/80 hover:text-primary underline flex items-center gap-1"
      >
        <MessageSquare className="size-3" />
        <span>Live Transcript</span>
      </a>
    </div>
  );
}
