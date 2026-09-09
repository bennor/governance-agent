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
        "relative flex w-[220px] flex-col rounded-xl border bg-card p-3.5 text-card-foreground shadow-sm transition-all duration-300",
        data.active && "ring-2 ring-primary border-primary shadow-md",
        data.active && data.amber && "ring-amber-500 border-amber-500",
        data.completed && "border-emerald-500/50 bg-emerald-500/5",
        data.failed && "border-destructive/60 bg-destructive/5"
      )}
    >
      {/* Left Handles */}
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground !size-2"
      />
      <Handle
        id="source-left"
        type="source"
        position={Position.Left}
        className="!bg-transparent !border-0 !size-1"
      />

      {/* Top Handles (for overhead feedback loops) */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !size-2"
      />
      <Handle
        id="source-top"
        type="source"
        position={Position.Top}
        className="!bg-muted-foreground !size-2"
      />

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

      {/* Bottom Handles (for downward vertical branches) */}
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !size-2"
      />
      <Handle
        id="target-bottom"
        type="target"
        position={Position.Bottom}
        className="!bg-muted-foreground !size-2"
      />

      {/* Right Handle (for forward flow) */}
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground !size-2"
      />
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
        position: { x: 30, y: 150 },
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
        position: { x: 290, y: 150 },
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
        position: { x: 550, y: 150 },
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
        position: { x: 810, y: 150 },
        data: {
          label: "4. Pull Request",
          stage: "awaiting_pull_request",
          subtext: prUrl ? "Provided" : "Awaiting",
          active: isAwaitingPr,
          completed: currentWeight > 4,
          icon: GitPullRequest,
          details: prUrl
            ? "Target repository pull request ready for code audit."
            : "Awaiting public GitHub pull request link.",
        },
      },
      {
        id: "verification",
        type: "stageNode",
        position: { x: 1070, y: 150 },
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
        position: { x: 1070, y: 320 },
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
        position: { x: 1330, y: 150 },
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
      // 1. Intake -> Drafting (forward right-to-left)
      {
        id: "e-intake-drafting",
        source: "intake",
        sourceHandle: "source-right",
        target: "drafting",
        targetHandle: "target-left",
        animated: isDrafting,
        style: { stroke: currentWeight >= 2 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      // 2. Drafting -> Review (forward right-to-left)
      {
        id: "e-drafting-review",
        source: "drafting",
        sourceHandle: "source-right",
        target: "review",
        targetHandle: "target-left",
        animated: isReview,
        style: { stroke: currentWeight >= 3 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      // 3. Review -> Drafting (overhead feedback loop: top-to-top)
      {
        id: "e-review-revision",
        source: "review",
        sourceHandle: "source-top",
        target: "drafting",
        targetHandle: "target-top",
        label: "Revisions",
        type: "smoothstep",
        animated: isDrafting && activeRevision > 1,
        style: { stroke: "#f59e0b", strokeDasharray: "5,5" },
        labelStyle: { fill: "#d97706", fontSize: 10, fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
      },
      // 4. Review -> PR (forward right-to-left)
      {
        id: "e-review-pr",
        source: "review",
        sourceHandle: "source-right",
        target: "pr_ready",
        targetHandle: "target-left",
        animated: isAwaitingPr,
        style: { stroke: currentWeight >= 4 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      // 5. PR -> Verification (forward right-to-left)
      {
        id: "e-pr-verify",
        source: "pr_ready",
        sourceHandle: "source-right",
        target: "verification",
        targetHandle: "target-left",
        animated: isVerifying,
        style: { stroke: currentWeight >= 5 ? "#10b981" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      // 6. Verification -> Remediation (clean vertical drop: bottom-to-top)
      {
        id: "e-verify-remediation",
        source: "verification",
        sourceHandle: "source-bottom",
        target: "remediation",
        targetHandle: "target-top",
        animated: isRemediation,
        style: { stroke: isRemediation ? "#ef4444" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      // 7. Remediation -> Verification (left loop: left-to-left)
      {
        id: "e-remediation-verify",
        source: "remediation",
        sourceHandle: "source-left",
        target: "verification",
        targetHandle: "target-left",
        label: "Fixes Pushed",
        type: "smoothstep",
        animated: isVerifying && (activeAttempt ?? 1) > 1,
        style: { stroke: "#3b82f6", strokeDasharray: "5,5" },
        labelStyle: { fill: "#2563eb", fontSize: 10, fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
      },
      // 8. Verification -> Verdict (forward right-to-left)
      {
        id: "e-verify-verdict",
        source: "verification",
        sourceHandle: "source-right",
        target: "verdict",
        targetHandle: "target-left",
        animated: isApproved,
        style: { stroke: isApproved ? "#10b981" : isFailed ? "#ef4444" : "#71717a" },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ],
    [
      currentWeight,
      isDrafting,
      isReview,
      isAwaitingPr,
      isVerifying,
      isRemediation,
      isApproved,
      isFailed,
      activeRevision,
      activeAttempt,
    ]
  );

  return (
    <div className="h-[440px] w-full rounded-xl border border-border bg-card/60 shadow-xs overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
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
