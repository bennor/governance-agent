"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import {
  FileText,
  FileEdit,
  UserCheck,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GovernanceStage, GovernanceStatus } from "@/agent/lib/governance/schemas";

interface StageNodeData extends Record<string, unknown> {
  label: string;
  stage: GovernanceStage;
  subtext?: string;
  active: boolean;
  completed?: boolean;
  failed?: boolean;
  amber?: boolean;
  details?: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StageCustomNode({ data }: NodeProps<Node<StageNodeData>>) {
  const Icon = data.icon;

  return (
    <div
      className={cn(
        "relative flex min-w-[200px] max-w-[240px] flex-col rounded-xl border bg-card p-3.5 text-card-foreground shadow-sm transition-all duration-300",
        data.active && "ring-2 ring-primary border-primary shadow-md",
        data.active && data.amber && "ring-amber-500 border-amber-500",
        data.completed && "border-emerald-500/50 bg-emerald-500/5",
        data.failed && "border-destructive/60 bg-destructive/5"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !size-2" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-lg border",
              data.active && !data.amber && "bg-primary text-primary-foreground border-primary",
              data.active && data.amber && "bg-amber-500 text-white border-amber-500 animate-pulse",
              data.completed && "bg-emerald-500 text-white border-emerald-500",
              data.failed && "bg-destructive text-white border-destructive",
              !data.active && !data.completed && !data.failed && "bg-muted text-muted-foreground"
            )}
          >
            {data.active && !data.completed && !data.failed ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Icon className="size-3.5" />
            )}
          </div>
          <span className="font-semibold text-xs tracking-tight">{data.label}</span>
        </div>

        {data.subtext ? (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
            {data.subtext}
          </Badge>
        ) : null}
      </div>

      {data.details ? (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
          {data.details}
        </p>
      ) : null}

      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !size-2" />
    </div>
  );
}

const nodeTypes = {
  stageNode: StageCustomNode,
};

export interface WorkflowGraphProps {
  currentStage: GovernanceStage;
  currentStatus: GovernanceStatus;
  activeRevision?: number;
  activeAttempt?: number | null;
  blockingCount?: number | null;
  prUrl?: string | null;
}

export function WorkflowGraph({
  currentStage,
  currentStatus,
  activeRevision = 1,
  activeAttempt = 1,
  blockingCount,
  prUrl,
}: WorkflowGraphProps) {
  const isDrafting = currentStage === "drafting";
  const isReview = currentStage === "baseline_review";
  const isAwaitingPr = currentStage === "awaiting_pull_request";
  const isVerifying = currentStage === "verifying";
  const isRemediation = currentStage === "remediation";
  const isApproved = currentStage === "approved";
  const isFailed = currentStage === "failed";
  const isCancelled = currentStage === "cancelled";

  // Stage order index for past completion evaluation
  const stageWeights: Record<GovernanceStage, number> = {
    intake: 1,
    drafting: 2,
    baseline_review: 3,
    awaiting_pull_request: 4,
    verifying: 5,
    remediation: 5,
    approved: 6,
    failed: 6,
    cancelled: 6,
  };

  const currentWeight = stageWeights[currentStage] ?? 1;

  const nodes: Node<StageNodeData>[] = useMemo(
    () => [
      {
        id: "intake",
        type: "stageNode",
        position: { x: 30, y: 120 },
        data: {
          label: "1. Intake",
          stage: "intake",
          active: currentStage === "intake",
          completed: currentWeight > 1,
          icon: FileText,
          details: "Feature specifications and security requirements captured.",
        },
      },
      {
        id: "drafting",
        type: "stageNode",
        position: { x: 280, y: 120 },
        data: {
          label: "2. Policy Drafting",
          stage: "drafting",
          subtext: `Rev ${activeRevision}`,
          active: isDrafting,
          completed: currentWeight > 2,
          icon: FileEdit,
          details: "Specialist drafter extracts normative controls into 4 baseline artefacts.",
        },
      },
      {
        id: "review",
        type: "stageNode",
        position: { x: 530, y: 120 },
        data: {
          label: "3. Baseline Review",
          stage: "baseline_review",
          subtext: "HITL Gate",
          active: isReview,
          amber: isReview,
          completed: currentWeight > 3,
          icon: UserCheck,
          details: "Human checkpoint: approve, revise, or cancel proposed baseline.",
        },
      },
      {
        id: "pr_ready",
        type: "stageNode",
        position: { x: 780, y: 120 },
        data: {
          label: "4. Pull Request",
          stage: "awaiting_pull_request",
          subtext: prUrl ? "Provided" : "Awaiting",
          active: isAwaitingPr,
          completed: currentWeight > 4,
          icon: GitPullRequest,
          details: prUrl ? "Target repository pull request ready for code audit." : "Awaiting public GitHub pull request link.",
        },
      },
      {
        id: "verification",
        type: "stageNode",
        position: { x: 1030, y: 120 },
        data: {
          label: "5. Code Audit",
          stage: "verifying",
          subtext: activeAttempt ? `Attempt ${activeAttempt}/3` : "Pending",
          active: isVerifying,
          completed: isApproved,
          failed: isFailed,
          icon: CheckCircle2,
          details: "Specialist verifier audits PR diffs with file and line evidence.",
        },
      },
      {
        id: "remediation",
        type: "stageNode",
        position: { x: 1030, y: 280 },
        data: {
          label: "Remediation",
          stage: "remediation",
          subtext: blockingCount ? `${blockingCount} blockers` : "Violations",
          active: isRemediation,
          failed: isRemediation,
          icon: AlertTriangle,
          details: "Non-compliant controls require developer fixes on branch.",
        },
      },
      {
        id: "verdict",
        type: "stageNode",
        position: { x: 1280, y: 120 },
        data: {
          label: isApproved ? "Release Approved" : isFailed ? "Release Rejected" : "Final Verdict",
          stage: isApproved ? "approved" : isFailed ? "failed" : "verifying",
          subtext: isApproved ? "Compliant" : isFailed ? "Failed" : "Gate",
          active: isApproved || isFailed || isCancelled,
          completed: isApproved,
          failed: isFailed || isCancelled,
          icon: isApproved ? CheckCircle2 : XCircle,
          details: isApproved
            ? "Pull request passed all normative controls. Approved for release."
            : isFailed
            ? "Maximum verification attempts exhausted with blocking violations."
            : isCancelled
            ? "Governance case cancelled by operator."
            : "Awaiting audit outcome.",
        },
      },
    ],
    [
      currentStage,
      currentWeight,
      activeRevision,
      activeAttempt,
      blockingCount,
      prUrl,
      isDrafting,
      isReview,
      isAwaitingPr,
      isVerifying,
      isRemediation,
      isApproved,
      isFailed,
      isCancelled,
    ]
  );

  const edges: Edge[] = useMemo(
    () => [
      {
        id: "e-intake-drafting",
        source: "intake",
        target: "drafting",
        animated: isDrafting,
        style: { stroke: currentWeight >= 2 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: "e-drafting-review",
        source: "drafting",
        target: "review",
        animated: isReview,
        style: { stroke: currentWeight >= 3 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        // Revision feedback loop
        id: "e-review-revision",
        source: "review",
        target: "drafting",
        label: "Revisions",
        type: "smoothstep",
        animated: isDrafting && activeRevision > 1,
        style: { stroke: "#f59e0b", strokeDasharray: "5,5" },
        labelStyle: { fill: "#d97706", fontSize: 10, fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
      },
      {
        id: "e-review-pr",
        source: "review",
        target: "pr_ready",
        animated: isAwaitingPr,
        style: { stroke: currentWeight >= 4 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: "e-pr-verify",
        source: "pr_ready",
        target: "verification",
        animated: isVerifying,
        style: { stroke: currentWeight >= 5 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        // Non-compliant branch to remediation
        id: "e-verify-remediation",
        source: "verification",
        target: "remediation",
        animated: isRemediation,
        style: { stroke: isRemediation ? "#ef4444" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        // Remediation fix loop back to verification
        id: "e-remediation-verify",
        source: "remediation",
        target: "verification",
        label: "Fixes Pushed",
        type: "smoothstep",
        animated: isVerifying && (activeAttempt ?? 1) > 1,
        style: { stroke: "#3b82f6", strokeDasharray: "5,5" },
        labelStyle: { fill: "#2563eb", fontSize: 10, fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
      },
      {
        id: "e-verify-verdict",
        source: "verification",
        target: "verdict",
        animated: isApproved,
        style: { stroke: isApproved ? "#10b981" : isFailed ? "#ef4444" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ],
    [currentWeight, isDrafting, isReview, isAwaitingPr, isVerifying, isRemediation, isApproved, isFailed, activeRevision, activeAttempt]
  );

  return (
    <div className="h-[400px] w-full rounded-xl border border-border bg-card/60 shadow-xs overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} className="!border-border !bg-background !shadow-xs" />
      </ReactFlow>
    </div>
  );
}
