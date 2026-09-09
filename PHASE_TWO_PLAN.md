# Governance Agent Phase Two Implementation Plan: Web Portal and Deterministic Workflow

An interactive web portal and deterministic, durable stage-gate workflow for the Eve governance agent, delivering visual state tracking, dedicated chat routing, and automated sub-agent delegation.

This document serves as the tracking and implementation plan for Phase Two. During implementation, completed checklist items must be marked off as `[x]`.

---

## 1. Context and Goals

### 1.1 Purpose
Phase One delivered the foundational governance capabilities: policy catalogue ingestion, sandboxed evaluation, Blob-backed persistence, and specialist sub-agents (`drafter` and `verifier`) orchestrated through coordinator instructions.

Phase Two builds an interactive, visual operator experience on top of those capabilities by:
1. Providing a dedicated governance portal at `/` with dashboard summaries, structured intake, and full case workspaces.
2. Moving conversational interactions to a dedicated `/chat` route, preserving direct access and session resumption.
3. Replacing model-mediated stage routing with a deterministic, durable workflow tool (`defineWorkflowTool`) that coordinates all phase transitions in code.
4. Calling the specialist sub-agents (`drafter` and `verifier`) synchronously from the workflow via `await ctx.agent(...)` for every policy drafting and code audit task.
5. Visualising the multi-stage governance lifecycle through an interactive, read-only React Flow graph (`@xyflow/react`) that reflects live workflow progress.
6. Persisting a lightweight `case.json` manifest in Vercel Blob to power dashboard listings and page reloads without requiring relational database infrastructure.

### 1.2 Scope and Exclusions
To keep the demonstration inspectable, fast to run, and focused on core governance UX, Phase Two establishes strict scope boundaries:

- **In Scope**:
  - Dedicated Next.js web portal at `/`, `/cases/new`, and `/cases/[caseId]`.
  - Dedicated chat interface moved to `/chat` and `/chat/[sessionId]`, with redirects from `/s/*`.
  - Deterministic stage-gate state machine executed as an Eve default-execution workflow tool.
  - Synchronous sub-agent delegation to `drafter` (baseline creation, revisions) and `verifier` (code diff audits).
  - Durable human-in-the-loop pauses via `ctx.ask(...)` for baseline review and remediation decisions.
  - Interactive React Flow workflow diagram rendering node states, active stage pulses, revision loops, and remediation loops.
  - Blob-backed `case.json` state projections and revision-specific artefact storage.
- **Explicitly Out of Scope**:
  - Relational database storage (PostgreSQL, Neon, Supabase, SQLite).
  - Ambient GitHub webhook listeners and automated background branch polling.
  - Multi-tenant enterprise RBAC or external identity providers.
  - Parallel multi-case merging or mono-repo split workflows.

### 1.3 Core Constraints
- **Sub-Agent Primacy**: The specialist sub-agents (`drafter` and `verifier`) remain the sole engines for policy assessment and pull request code auditing. The coordinator workflow must never draft assurance documents or perform code diff reviews directly.
- **Deterministic Orchestration**: State transitions, attempt limits (maximum 3 verification attempts), approval invalidation, and pull request URL validation must be evaluated strictly in TypeScript code rather than left to prompt interpretation.
- **Blocking Delegation**: Sub-agent tasks invoked by the workflow tool use `await ctx.agent(...)` with stable replay keys, ensuring execution halts until the sub-agent persists its files and returns its structured schema.
- **No Relational Infrastructure**: Case listings, status projections, and document retrieval rely exclusively on Vercel Blob storage keys and server-side Next.js route handlers.
- **Independent Chat Surface**: Conversational access to the root agent must remain functional at `/chat`, with deep links connecting the portal case workspace to the underlying Eve session transcript.

---

## 2. Phase Two Architecture Overview

```
                                  +---------------------------------------+
                                  |            Operator Browser           |
                                  +---------------------------------------+
                                      |                               |
             1. Portal UI (Dashboard, |                               | 2. Direct Chat
                Intake, Case Views)   v                               v
                            +--------------------+          +--------------------+
                            |  Governance Portal |          |   Agent Chat UI    |
                            |  (/, /cases/*)     |          |  (/chat, /chat/*)  |
                            +--------------------+          +--------------------+
                                      |                               |
                                      +---------------+---------------+
                                                      |
                                                      v HTTP / Stream
                                      +-----------------------------------+
                                      |       Same-Origin /eve/v1/*       |
                                      +-----------------------------------+
                                                      |
                                                      v
                                      +-----------------------------------+
                                      |    Root Coordinator Agent         |
                                      |    (Intake Router & Presenter)    |
                                      +-----------------------------------+
                                                      |
                                                      | Invokes Tool
                                                      v
                                      +-----------------------------------+
                                      |     run_governance_case           |
                                      |     (Deterministic Workflow Tool) |
                                      +-----------------------------------+
                                           |                         |
                          await ctx.agent  |                         | await ctx.agent
                          (key: draft-*)   v                         v (key: verify-*)
                                 +------------------+       +-------------------+
                                 |  Drafter Station |       |  Verifier Station |
                                 |  Sub-Agent       |       |  Sub-Agent        |
                                 +------------------+       +-------------------+
                                           |                         |
                                           +------------+------------+
                                                        |
                                                        v Read / Write
                                 +----------------------------------------------+
                                 |               Shared Sandbox                 |
                                 |  - /workspace/policies (7 Normative Standards)|
                                 |  - /workspace/cases/<caseId>/ (Local Caches) |
                                 |  - /workspace/repositories/ (Cloned PR Diffs)|
                                 +----------------------------------------------+
                                                        |
                                                        | Authoritative Storage
                                                        v
                                 +----------------------------------------------+
                                 |         Durable Store (Vercel Blob)          |
                                 |  - governance/runs/<caseId>/case.json        |
                                 |  - governance/runs/<caseId>/baseline/rev-N/  |
                                 |  - governance/runs/<caseId>/verification/... |
                                 +----------------------------------------------+
```

### 2.1 Component Responsibilities
- **Governance Portal (`app/`, `app/cases/`)**:
  - Server-rendered dashboard displaying active, pending, and completed governance cases.
  - Structured intake form capturing technical scope, security attributes, and repository details.
  - Dedicated case workspace displaying document tabs, audit findings, and operator actions.
  - Interactive React Flow diagram illustrating stage progression, active execution, and retry loops.
- **Dedicated Chat Route (`app/chat/`)**:
  - Full-featured conversational UI using `useEveAgent()` from `eve/react`.
  - Resumes sessions by ID with streaming responses, tool output rendering, and cancellation controls.
  - Backward-compatible redirects from legacy `/s` routes.
- **Root Coordinator Agent (`agent/agent.ts`, `agent/instructions.md`)**:
  - Serves as the intake classifier and response presenter.
  - Delegates execution to the `run_governance_case` workflow tool immediately upon receiving a change request.
  - Does not attempt to draft documents, inspect code, or advance stages via conversational heuristics.
- **Deterministic Workflow Tool (`agent/tools/run_governance_case.ts`)**:
  - Authored using `defineWorkflowTool` with default execution (suspends durably while waiting for inputs).
  - Enforces strict stage transitions: Intake -> Drafting -> Review -> PR Collection -> Verification -> Remediation -> Terminal Verdict.
  - Calls `drafter` and `verifier` via `await ctx.agent(...)` with replay-safe keys.
  - Issues human-in-the-loop prompts via `await ctx.ask(...)` for review approval and remediation decisions.
  - Emits real-time progress snapshots via generator `yield` statements to drive live UI updates.
- **Drafter Sub-Agent (`agent/subagents/drafter/`)**:
  - Evaluates feature intake against the seven normative policy files in `/workspace/policies/`.
  - Generates and saves four mandatory markdown artefacts under the active revision path.
- **Verifier Sub-Agent (`agent/subagents/verifier/`)**:
  - Clones the target public GitHub repository and checks out the pull request ref.
  - Reads the approved implementation requirements baseline.
  - Audits code diffs line by line, evaluating controls with concrete evidence.
  - Writes a versioned audit report (`verification-report-attempt-N.md`) and returns structured findings.
- **Durable Storage (`agent/lib/documents/storage.ts`)**:
  - Persists case manifests, versioned baselines, approved snapshots, and audit reports in Vercel Blob.
  - Provides server-side helper functions for portal listing and document streaming.

### 2.2 Sub-Agent Delegation Contract
Delegation from the deterministic workflow tool to sub-agents adheres to strict operational rules:

1. **Replay-Safe Stable Keys**: Every `ctx.agent()` call supplies a deterministic key tied to the revision or attempt index:
   - Drafting: `key: "draft-revision-1"`, `key: "draft-revision-2"`
   - Verification: `key: "verify-attempt-1"`, `key: "verify-attempt-2"`, `key: "verify-attempt-3"`
2. **Synchronous Await**: The workflow tool awaits the sub-agent response directly. Because default execution is used, the workflow suspends during model processing and resumes only after the sub-agent returns its validated `outputSchema`.
3. **Physical File Verification**: After a sub-agent completes, the workflow executes a step to verify that the required files physically exist in Blob storage before transitioning to the next stage.
4. **Clean Input Payloads**: Sub-agents receive clean, JSON-stringified payloads containing all necessary context (intake details, feedback, revision counts, PR URL, approved baseline path), ensuring independence from conversational parent history.

---

## 3. Deterministic Workflow Specification

### 3.1 Stage-Gate State Machine

```
   [Intake Submitted]
           |
           v
    +--------------+
    |   Drafting   | <-----------------------+
    +--------------+                         |
           |                                 |
           | (4 Artefacts Saved)             | (Revisions Requested)
           v                                 |
+----------------------+                     |
|   Baseline Review    | --------------------+
+----------------------+
           |
           | (Approved by Human)
           v
+----------------------+
| Await Pull Request   |
+----------------------+
           |
           | (Valid GitHub PR URL)
           v
    +--------------+
    | Verification | <-----------------------+
    +--------------+                         |
           |                                 |
           +--------------------+            | (Attempt < 3 & Fixes Pushed)
           |                    |            |
           | (Compliant)        | (Non-Compliant)
           v                    v            |
    +--------------+     +---------------+   |
    |   Approved   |     |  Remediation  | --+
    +--------------+     +---------------+
      (Terminal)                |
                                | (Attempt >= 3 or Cancelled)
                                v
                         +---------------+
                         |     Failed    |
                         +---------------+
                            (Terminal)
```

#### Valid State Transitions:
1. `intake` -> `drafting`: Triggered immediately upon workflow execution.
2. `drafting` -> `baseline_review`: Occurs when `drafter` returns `status: "completed"` and all 4 documents exist.
3. `baseline_review` -> `drafting`: Occurs when the operator selects "Request revisions" via `ctx.ask`. Increments `revision`.
4. `baseline_review` -> `cancelled`: Occurs when the operator selects "Cancel change". (Terminal)
5. `baseline_review` -> `awaiting_pull_request`: Occurs when the operator approves without providing a PR URL.
6. `baseline_review` -> `verifying`: Occurs when the operator approves and supplies a valid PR URL.
7. `awaiting_pull_request` -> `verifying`: Occurs when a valid GitHub PR URL is provided.
8. `verifying` -> `approved`: Occurs when `verifier` returns `verdict: "compliant"` (zero blocking findings). (Terminal)
9. `verifying` -> `remediation`: Occurs when `verifier` returns `verdict: "non_compliant"` and `attempt < 3`.
10. `remediation` -> `verifying`: Occurs when the operator confirms fixes are pushed. Increments `attempt`.
11. `remediation` -> `failed`: Occurs when operator cancels or threshold exhausted (`attempt >= 3`). (Terminal)
12. `verifying` -> `unable_to_verify`: Occurs if repository cannot be cloned or PR cannot be fetched. Prompts operator for corrected URL.

### 3.2 Workflow Tool Definition (`run_governance_case.ts`)
The workflow tool will be implemented as follows:

- **Path**: `agent/tools/run_governance_case.ts`
- **Export**: Default export of `defineWorkflowTool({...})`.
- **Execution Mode**: Default execution (no `execution: "background"`), allowing the tool call to remain open while durably suspending during operator prompts.
- **Top Directive**: `"use workflow"` inside the `execute` generator function.
- **Side Effect Encapsulation**: Blob persistence, manifest updates, and date generation isolated inside `"use step"` functions.

```ts
// Structural outline of agent/tools/run_governance_case.ts
export default defineWorkflowTool({
  description: "Deterministic release governance orchestrator running drafting, approval, and verification.",
  inputSchema: governanceIntakeSchema,
  outputSchema: governanceCaseResultSchema,
  async *execute(intake, ctx) {
    "use workflow";
    
    // 1. Initialise Case Manifest
    let currentCase = await initCaseStep(ctx.session.id, intake);
    yield { stage: "drafting", status: "active", revision: 1 };

    // 2. Drafting Loop (Supports Revisions)
    let revision = 1;
    let revisionFeedback: string | undefined;
    
    while (true) {
      const draftResult = await ctx.agent({
        key: `draft-revision-${revision}`,
        target: "drafter",
        message: JSON.stringify({ task: "draft", intake, revision, feedback: revisionFeedback }),
        outputSchema: drafterResultSchema,
      });

      await verifyBaselineDocumentsStep(currentCase.id, revision);
      await updateCaseStageStep(currentCase.id, "baseline_review", { revision, draftResult });
      yield { stage: "baseline_review", status: "awaiting_approval", revision };

      const reviewDecision = await ctx.ask({
        prompt: `Assurance baseline revision ${revision} is ready for review.`,
        display: "select",
        options: [
          { id: "approve", label: "Approve baseline", style: "primary" },
          { id: "revise", label: "Request revisions" },
          { id: "cancel", label: "Cancel change", style: "danger" },
        ],
        allowFreeform: true,
      });

      if (reviewDecision.optionId === "cancel") {
        await updateCaseStageStep(currentCase.id, "cancelled");
        return { status: "cancelled", caseId: currentCase.id };
      }

      if (reviewDecision.optionId === "revise") {
        revision += 1;
        revisionFeedback = reviewDecision.text ?? "Operator requested unspecified revisions.";
        yield { stage: "drafting", status: "active", revision };
        continue;
      }

      // Approved: bind immutable snapshot
      await freezeApprovedBaselineStep(currentCase.id, revision);
      break;
    }

    // 3. Obtain GitHub Pull Request URL
    let prUrl = extractPrUrl(intake.pullRequestUrl);
    if (!prUrl) {
      yield { stage: "awaiting_pull_request", status: "active" };
      const prResponse = await ctx.ask({
        prompt: "Please provide the public GitHub pull request URL for verification.",
        display: "text",
        allowFreeform: true,
      });
      prUrl = extractPrUrl(prResponse.text);
    }

    // 4. Verification & Remediation Loop
    let attempt = 1;
    while (attempt <= 3) {
      yield { stage: "verifying", status: "active", attempt };
      await updateCaseStageStep(currentCase.id, "verifying", { attempt, prUrl });

      const auditResult = await ctx.agent({
        key: `verify-attempt-${attempt}`,
        target: "verifier",
        message: JSON.stringify({ task: "verify", pullRequestUrl: prUrl, attempt }),
        outputSchema: verifierResultSchema,
      });

      await verifyAuditReportStep(currentCase.id, attempt);

      if (auditResult.verdict === "compliant") {
        await updateCaseStageStep(currentCase.id, "approved", { auditResult });
        yield { stage: "approved", status: "completed", attempt };
        return { status: "approved", caseId: currentCase.id, attempts: attempt };
      }

      if (attempt >= 3) {
        await updateCaseStageStep(currentCase.id, "failed", { auditResult });
        yield { stage: "failed", status: "completed", attempt };
        return { status: "failed", caseId: currentCase.id, attempts: attempt };
      }

      // Remediation Required
      await updateCaseStageStep(currentCase.id, "remediation", { attempt, auditResult });
      yield { stage: "remediation", status: "awaiting_fix", attempt, findings: auditResult.findings };

      const remediationAction = await ctx.ask({
        prompt: `Verification attempt ${attempt} found non-compliant controls. Push fixes and request re-verification.`,
        display: "select",
        options: [
          { id: "reverify", label: "Re-verify pull request", style: "primary" },
          { id: "cancel", label: "Cancel change", style: "danger" },
        ],
        allowFreeform: true,
      });

      if (remediationAction.optionId === "cancel") {
        await updateCaseStageStep(currentCase.id, "cancelled");
        return { status: "cancelled", caseId: currentCase.id, attempts: attempt };
      }

      attempt += 1;
    }

    return { status: "failed", caseId: currentCase.id, attempts: 3 };
  },
});
```

### 3.3 Progressive Progress Events and Snapshots
The generator yields progress snapshots at each milestone. In default execution mode, Eve delivers these as `action.partial` snapshots over the active session stream. The web portal consumes these events to animate graph nodes and update stage banners in real time.

---

## 4. Web Portal Route Map and UI Specification

### 4.1 Route Structure

```
app/
├── layout.tsx                      # Root layout (fonts, providers, portal navigation)
├── globals.css                     # Tailwind 4 theme and React Flow styling
├── page.tsx                        # Governance Dashboard (Cases overview & metrics)
├── cases/
│   ├── new/
│   │   └── page.tsx                # Structured Feature Intake Form
│   └── [caseId]/
│       └── page.tsx                # Comprehensive Case Workspace & Flow View
├── chat/
│   ├── page.tsx                    # Dedicated Standalone Chat (New session)
│   └── [sessionId]/
│       └── page.tsx                # Resumable Standalone Chat Session
├── s/
│   ├── page.tsx                    # Legacy redirect -> /chat
│   └── [sessionId]/
│       └── page.tsx                # Legacy redirect -> /chat/[sessionId]
└── api/
    └── cases/
        ├── route.ts                # GET: List all cases
        └── [caseId]/
            ├── route.ts            # GET: Single case manifest
            └── documents/
                └── [...filename]/
                    └── route.ts    # GET: Stream/download case documents
```

### 4.2 Route-by-Route Specification

#### Route: `/` (Governance Dashboard)
- **Header**: Navigation bar with links to Cases, New Case, Catalogue Standards, and Direct Chat.
- **Metrics Bar**: Counters for Total Cases, Awaiting Review, In Remediation, and Compliant Releases.
- **Active Cases Table**:
  - Columns: Case ID, Title, Stage (with colour-coded badge), Revision/Attempt, Last Updated, Actions.
  - Action buttons: "Open Case Workspace" linking to `/cases/[caseId]`.
- **Quick Intake Card**: Callout prompting the operator to start a new change governance case.

#### Route: `/cases/new` (Feature Intake Form)
- **Form Fields**:
  - Feature Title (text input)
  - Business Purpose & Context (textarea)
  - Technical Scope & Architecture (textarea)
  - Data Classification (Select: None / Internal / PII / Confidential)
  - Public GitHub PR URL (optional at intake)
- **Pre-Fill Actions**: One-click button to load the canonical demo feedback form prompt.
- **Submission Action**:
  - Triggers session creation via `POST /eve/v1/session`.
  - Sends formatted intake JSON.
  - Captures the returned `sessionId` (the case ID) and redirects to `/cases/[sessionId]`.

#### Route: `/cases/[caseId]` (Case Workspace)
This is the primary operational surface for release governance. It features a three-panel responsive layout:
1. **Header & Context Bar**:
   - Case ID, Feature Title, Current Status Badge, Direct link to chat session (`/chat/[caseId]`).
2. **Top / Left Panel: Interactive Workflow Graph**:
   - React Flow component showing the full stage progression.
   - Live node highlighting reflecting current stage (`drafting`, `review`, `verifying`, etc.).
   - Interactive node click to filter displayed documents or findings.
3. **Bottom / Right Panel: Dual Workspace (Documents & Findings)**:
   - **Tab 1: Assurance Baseline Documents**:
     - Sub-tabs for `change-design.md`, `security-and-data-review.md`, `implementation-requirements.md`, and `policy-applicability.md`.
     - Rendered Markdown viewer with syntax-highlighted code blocks and tables.
   - **Tab 2: Operator Action & Gating**:
     - When status is `awaiting_approval`: Displays baseline summary and buttons: `Approve Baseline`, `Request Revision`, `Cancel`.
     - When status is `awaiting_pull_request`: Input form for GitHub PR URL.
     - When status is `remediation`: Summary of failing controls, remediation guidance, and `Re-Verify` button.
   - **Tab 3: Verification Audit Reports**:
     - Attempt selector (Attempt 1, Attempt 2, Attempt 3).
     - Breakdown of controls (`pass`, `fail`, `not_applicable`) with line-level code citations.
     - Full rendered `verification-report-attempt-N.md`.

#### Route: `/chat` & `/chat/[sessionId]` (Direct Conversational Interface)
- Hosts the existing `AgentChat` component.
- Preserves all conversational capabilities: prompt inputs, streaming markdown, reasoning traces, and raw tool invocation blocks.
- Top banner: "Viewing Case Transcript for [caseId] - Return to Visual Workspace".

### 4.3 Interactive Workflow Graph (React Flow)
Using `@xyflow/react`, the portal renders a directed state graph representing the case:

- **Nodes**:
  - `Node 1: Intake` (Captured metadata)
  - `Node 2: Drafting` (Shows active revision number; pulsing border when busy)
  - `Node 3: Baseline Review` (HITL checkpoint; amber highlight when awaiting operator input)
  - `Node 4: PR Ready` (GitHub link badge)
  - `Node 5: Verification` (Shows attempt number; spinning audit indicator)
  - `Node 6: Remediation` (Displayed if non-compliant findings occur)
  - `Node 7: Final Verdict` (Green `Approved` or Red `Failed`)
- **Edges**:
  - Forward directed arrows for standard path.
  - Curved feedback edge from `Baseline Review` -> `Drafting` (labelled "Revision").
  - Curved feedback edge from `Remediation` -> `Verification` (labelled "Fixes Pushed").
- **Properties**:
  - Read-only navigation (node dragging disabled or locked to layout).
  - High-contrast accessible theme adhering to light/dark system settings.
  - Automatic zoom-to-fit on mobile screens with responsive layout toggling.

### 4.4 Backward Compatibility and Chat Route Separation
- Refactor `app/_components/agent-chat.tsx` to accept a `sessionBasePath` prop (defaulting to `/chat`).
- Update `History.prototype.replaceState` to use `/chat/${sessionId}`.
- Configure `app/s/page.tsx` and `app/s/[sessionId]/page.tsx` to issue permanent or client-side redirects to `/chat` and `/chat/[sessionId]`.

---

## 5. Blob-Backed Case State and Projection Model

### 5.1 Storage Directory Structure
Vercel Blob storage paths are versioned and structured systematically:

```text
governance/runs/<caseId>/
├── case.json                                      # Current manifest projection
├── baseline/
│   ├── revision-1/
│   │   ├── change-design.md
│   │   ├── security-and-data-review.md
│   │   ├── implementation-requirements.md
│   │   └── policy-applicability.md
│   ├── revision-2/                               # Created if revisions requested
│   │   └── ...
│   └── approved/                                 # Symlinked/copied approved snapshot
│       ├── change-design.md
│       ├── security-and-data-review.md
│       ├── implementation-requirements.md
│       └── policy-applicability.md
└── verification/
    ├── attempt-1/
    │   ├── verification-report-attempt-1.md
    │   └── result.json                           # Structured findings & blocking count
    └── attempt-2/
        ├── verification-report-attempt-2.md
        └── result.json
```

### 5.2 Case Manifest Schema (`case.json`)
The `case.json` file is updated after each stage gate to allow server-side dashboard rendering without querying the Eve agent stream:

```json
{
  "caseId": "wrun_01JKX9827...",
  "createdAt": "2026-09-10T06:00:00Z",
  "updatedAt": "2026-09-10T06:05:30Z",
  "title": "Customer Feedback Submission API",
  "intake": {
    "summary": "Customer feedback form submitting to /api/feedback",
    "technicalScope": "Next.js App Router, Zod validation, error sanitisation"
  },
  "stage": "baseline_review",
  "status": "awaiting_approval",
  "activeRevision": 1,
  "approvedRevision": null,
  "activeAttempt": null,
  "pullRequestUrl": "https://github.com/example/demo-app/pull/1",
  "verdict": null,
  "blockingCount": null,
  "documents": [
    {
      "filename": "change-design.md",
      "revision": 1,
      "blobUrl": "https://...blob.vercel-storage.com/.../change-design.md"
    }
  ]
}
```

---

## 6. Detailed Implementation Checklist

### Phase 2.1: Shared Schemas and State Machine
- [ ] Define shared Zod contracts in `agent/lib/governance/schemas.ts`:
  - `governanceIntakeSchema`
  - `caseManifestSchema`
  - `workflowProgressSchema`
  - `governanceCaseResultSchema`
- [ ] Implement pure state machine in `agent/lib/governance/state-machine.ts`:
  - Allowed transitions and rejection logic.
  - Revision increment and approval snapshot binding.
  - Verification attempt counting and 3-attempt ceiling.
- [ ] Add unit tests verifying state transitions, invalid transition rejections, and attempt boundaries.

### Phase 2.2: Versioned Storage Layer
- [ ] Update `agent/lib/documents/storage.ts`:
  - Implement `saveCaseManifest(caseId, manifest)` and `readCaseManifest(caseId)`.
  - Implement `listCaseManifests()` using Blob prefix listing.
  - Implement revisioned paths: `saveCaseDocumentVersion(caseId, revision, filename, content)`.
  - Implement approved baseline snapshot helper: `freezeApprovedBaseline(caseId, revision)`.
  - Implement attempt-specific report saving: `saveVerificationReportVersion(caseId, attempt, content, result)`.
- [ ] Add unit tests for storage path derivation, traversal sanitisation, and manifest serialization.

### Phase 2.3: Deterministic Workflow Tool
- [ ] Author `agent/tools/run_governance_case.ts`:
  - Default execution with `"use workflow"` directive.
  - Replay-safe sub-agent delegation (`await ctx.agent(...)`) to `drafter` for baseline and revisions.
  - Replay-safe sub-agent delegation (`await ctx.agent(...)`) to `verifier` for each audit attempt.
  - Operator checkpoints (`await ctx.ask(...)`) for baseline approval and remediation decisions.
  - Progress event streaming via generator `yield` statements.
  - Safe step boundaries (`"use step"`) for all storage operations.
- [ ] Update `agent/subagents/drafter/tools/save_document.ts` to support revisioned output paths.
- [ ] Update `agent/subagents/verifier/tools/read_document.ts` to read from the approved baseline snapshot.
- [ ] Update `agent/subagents/verifier/tools/save_verification_report.ts` to write to versioned attempt paths.
- [ ] Disable the generic root-copy `agent` tool by creating `agent/tools/agent.ts` with `disableTool()`.

### Phase 2.4: Root Coordinator Refactoring
- [ ] Update `agent/instructions.md`:
  - Direct the coordinator to recognise governance requests and execute `run_governance_case`.
  - Prohibit direct baseline authoring or code auditing by the coordinator.
  - Mandate that all sub-agent coordination occurs through the deterministic workflow tool.
  - Format the returned workflow outcome as an executive summary for chat users.

### Phase 2.5: Chat Route Separation
- [ ] Parameterise `app/_components/agent-chat.tsx` with `sessionBasePath` (defaulting to `/chat`).
- [ ] Create `app/chat/page.tsx` for new sessionless chat.
- [ ] Create `app/chat/[sessionId]/page.tsx` for resuming existing chat sessions.
- [ ] Update `app/s/page.tsx` and `app/s/[sessionId]/page.tsx` to redirect to `/chat`.
- [ ] Verify that chat streaming, tool rendering, and cancellation operate cleanly under `/chat`.

### Phase 2.6: Web Portal Shell and Dashboard
- [ ] Install `@xyflow/react` for graph visualisations.
- [ ] Create missing UI primitives under `components/ui/`: `card.tsx`, `table.tsx`, `tabs.tsx`, `progress.tsx`.
- [ ] Author `app/_components/portal-navigation.tsx` with links to Cases, New Case, Standards, and Chat.
- [ ] Build `app/page.tsx` (Governance Dashboard):
  - Metric summary cards (Total, In Review, In Remediation, Compliant).
  - Table of active and completed cases with direct links.
- [ ] Build `app/cases/new/page.tsx` (Feature Intake Form):
  - Form validation, template pre-fill, and submission handler.
  - Automatic redirect to `/cases/[caseId]` upon session establishment.

### Phase 2.7: Case Workspace and Visual Workflow Graph
- [ ] Build `app/_components/workflow-graph.tsx` using `@xyflow/react`:
  - Custom nodes for Intake, Drafting, Review, PR Ready, Verification, Remediation, Verdict.
  - Live status indicators (Pending, In Progress, Complete, Failed).
  - Feedback loops for revisions and remediation.
- [ ] Build `app/_components/document-viewer.tsx` to display rendered Markdown documents.
- [ ] Build `app/_components/audit-findings-viewer.tsx` to display control evaluations and citations.
- [ ] Build `app/_components/operator-controls.tsx` to render interactive approval, revision, PR URL, and remediation buttons.
- [ ] Assemble `app/cases/[caseId]/page.tsx` integrating the graph, document viewer, and operator controls.

### Phase 2.8: API Routes and Proxying
- [ ] Implement `app/api/cases/route.ts` to list cases for the dashboard.
- [ ] Implement `app/api/cases/[caseId]/route.ts` to return current case manifest and stream status.
- [ ] Implement `app/api/cases/[caseId]/documents/[...filename]/route.ts` to serve Markdown documents.

### Phase 2.9: Full System Verification
- [ ] Run `pnpm run typecheck` across the entire workspace.
- [ ] Run `pnpm run build:eve` to ensure agent, subagents, and workflow tools compile cleanly.
- [ ] Run `pnpm run build` to verify Next.js production builds.
- [ ] Execute end-to-end demo walkthrough:
  - Non-compliant branch triggers remediation loop.
  - Compliant branch achieves approved status.
- [ ] Update `PLAN.md` and `README.md` to document Phase Two completion.

---

## 7. Test and Demonstration Scenarios

### 7.1 Primary End-to-End Walkthrough
1. **Intake Submission**:
   - Operator opens `/cases/new`, clicks "Load Demo Feedback Prompt", and submits.
   - Portal redirects to `/cases/<caseId>`.
2. **Visual Drafting**:
   - React Flow graph highlights `Drafting` in active pulsing state.
   - Workflow awaits `drafter` sub-agent.
   - All four documents appear in the document viewer tabs upon completion.
3. **HITL Review**:
   - Graph transitions to `Baseline Review` with amber indicator.
   - Operator inspects requirements and clicks `Request Revisions` with note: "Add rate limiting control".
   - Graph animates revision loop back to `Drafting`.
   - `drafter` updates artefacts; operator clicks `Approve Baseline`.
4. **Pull Request Verification (Attempt 1)**:
   - Operator submits non-compliant pull request URL (`demo/feedback-non-compliant`).
   - Graph highlights `Verification` (Attempt 1).
   - `verifier` audits diff and returns non-compliant verdict (`SEC-001`, `DAT-003`, `API-005` failures).
   - Graph transitions to `Remediation`.
5. **Remediation & Compliance (Attempt 2)**:
   - Operator pushes fixes to PR and clicks `Re-Verify`.
   - Graph loops back to `Verification` (Attempt 2).
   - `verifier` passes all controls.
   - Graph transitions to `Approved` with green banner.
6. **Persistence & Direct Chat**:
   - Refreshing `/cases/<caseId>` immediately re-renders final graph and reports from `case.json`.
   - Operator clicks "View Chat Transcript" to inspect full conversational logs at `/chat/<caseId>`.

### 7.2 Secondary and Edge-Case Scenarios
- **Direct Chat Interaction**: Starting a case directly in `/chat` still engages the workflow and links back to `/cases/<caseId>`.
- **Cancellation**: Operator selects `Cancel change` during review; graph terminates immediately in `Cancelled` state.
- **Exhausted Attempts**: Three consecutive non-compliant audits trigger automatic terminal `Failed` state.
- **Transient Clone Errors**: Providing an invalid GitHub URL prompts for re-entry without incrementing the compliance attempt counter.

---

## 8. Execution Rules During Implementation

1. **Sub-Agents Are Mandatory**: Never delete, bypass, or combine the `drafter` and `verifier` sub-agents. They are foundational architectural pillars.
2. **Blocking Sub-Agent Invocations**: All sub-agent delegations in the workflow must use `await ctx.agent(...)` with stable keys.
3. **No Database Dependencies**: Store all state projections in Vercel Blob. Do not add Postgres or ORM libraries.
4. **Australasian Conventions**: Use Australian spelling (e.g. *behaviour*, *optimise*, *artefacts*), no em dashes, and clear, active prose.
5. **Continuous Verification**: Check off checklist items as they are implemented and verify TypeScript compilation after each phase.
