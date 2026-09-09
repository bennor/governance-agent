# Governance Agent Implementation Plan

An agentic change-management and governance system built on Eve to make regulated software releases faster, safer, and auditable.

This document serves as the tracking and implementation plan. During implementation, completed items must be marked off as `[x]`.

---

## 1. Context and Goals

### 1.1 Purpose
The governance agent assists engineering teams in regulated organisations to safely deliver features by:
1. Translating standard feature intake prompts into structured compliance and assurance artefacts based on internal software standards.
2. Storing versioned assurance baselines in durable object storage (Vercel Blob).
3. Enforcing an explicit human-in-the-loop (HITL) review checkpoint before implementation review starts.
4. Auditing implementation pull requests in a public GitHub repository against the approved assurance baseline.
5. Providing specific, actionable remediation findings if non-compliant, supporting iterative re-verification within the same session.

### 1.2 Core Constraints
- **Mandatory Sub-Agents**: The specialist sub-agents (`drafter` and `verifier`) are absolutely required components of the architecture and must not be removed, bypassed, or merged into the coordinator at any point. Strict separation of duties between baseline establishment and independent verification is mandatory.
- **Blocking Sub-Agent Execution**: Sub-agent execution must be synchronous and blocking. The coordinator halts and waits for the sub-agent to complete its entire workflow and return its response before communicating with the user. It must never emit premature interim status messages or run sub-agent tasks as unmonitored background jobs.
- **Actual Artefact Creation**: The `drafter` sub-agent must physically generate and persist all four assurance documents before completing. The `verifier` sub-agent must complete its audit and persist the verification report before completing.
- **Simplicity Over Completeness**: Designed as an inspectable demonstration. Uses public GitHub repositories without connector authentication, file-traversal RAG in sandboxes instead of vector embeddings, and single-session durable workflows.
- **Durable Case Identity**: The case ID is the root Eve session ID (`ctx.session.parent?.rootSessionId ?? ctx.session.parent?.sessionId ?? ctx.session.id`).
- **Phase Separation**:
  - **Phase 1 (Current)**: Fully Eve-based workflow orchestrated via instructions and declared subagents. Eve channel only.
  - **Phase 2 (Future)**: Dedicated web portal intake, deterministic stage-gate orchestration with Vercel Workflow SDK, ambient branch monitoring, and relational audit storage.

---

## 2. Architecture Overview

```
                                +---------------------------+
                                |      Human Operator       |
                                +---------------------------+
                                  |                       ^
                 1. Feature Intake|                       | 4. Review & Supply PR
                                  v                       |
                        +-------------------+             |
                        |   Root Agent      |-------------+
                        |   (Coordinator)   |
                        +-------------------+
                          |               |
         2. Delegate Plan |               | 5. Delegate Audit
                          v               v
                +-------------+       +---------------+
                |   Drafter   |       |   Verifier    |
                |  (Station)  |       |   (Station)   |
                +-------------+       +---------------+
                       |                      |
      3. Read Policies |     Read Documents   | 6. Clone & Verify
         & Save Bundle v     & Write Report   v
          +-----------------------------------------------+
          |               Shared Sandbox                  |
          |  - /workspace/policies (Domain Taxonomy)      |
          |  - /workspace/cases/<sessionId> (Local Cache) |
          |  - /workspace/repositories (Cloned PRs)       |
          +-----------------------------------------------+
                                  |
                                  | Read / Write
                                  v
          +-----------------------------------------------+
          |          Durable Store (Vercel Blob)          |
          |  - governance-demo/runs/<sessionId>/...       |
          +-----------------------------------------------+
```

### 2.1 Component Responsibilities
- **Root Coordinator (`agent/instructions.md`)**:
  - Manages the single-case lifecycle and state transitions.
  - Coordinates mandatory sub-agents using a blocking execution protocol (waits for sub-agent completion before outputting user-facing responses).
  - Delegates to `drafter` upon receiving an intake prompt without emitting premature background status updates.
  - Halts at `ask_question` for human review of drafted documents once `drafter` finishes.
  - Collects the GitHub pull request URL.
  - Delegates to `verifier` to evaluate the implementation and blocks until the full audit report and verdict are returned.
  - Runs the correction loop (up to 3 verification attempts) if findings remain.
- **Drafter Station Sub-Agent (`agent/subagents/drafter/`)** (Required component, never to be removed):
  - Traverses `/workspace/policies` using catalog metadata and keyword search.
  - Determines policy applicability with justifications.
  - Extracts normative requirements and control IDs.
  - Generates four assurance artefacts: `change-design.md`, `security-and-data-review.md`, `implementation-requirements.md`, and `policy-applicability.md`.
  - Actually persists copies to the sandbox, host workspace, and Vercel Blob before completing.
- **Verifier Station Sub-Agent (`agent/subagents/verifier/`)** (Required component, never to be removed):
  - Validates public GitHub pull request URLs.
  - Clones the repository and fetches the pull request head ref into `/workspace/repositories/`.
  - Reads approved requirements from storage.
  - Analyses diffs, file trees, configurations, and test suites.
  - Evaluates each control with file-and-line evidence.
  - Saves a versioned audit report (`verification-report-attempt-N.md`) to storage before returning.
  - Returns a structured verdict (`compliant`, `non_compliant`, or `unable_to_verify`).
- **Shared Sandbox (`agent/sandbox/`)**:
  - Uses `defaultBackend()` to support macOS local dev (Docker / MicroSandbox / just-bash) and Vercel Sandbox in deployment.
  - Seeds domain-categorised engineering policies into `/workspace/policies`.
  - Shared by root and child subagents via `defineSandbox(({ parent }) => parent.sandbox)`.

---

## 3. Seeded Policy Taxonomy

Policies reside at `agent/sandbox/workspace/policies/` with an index at `catalog.json`:

```
agent/sandbox/workspace/policies/
├── README.md
├── catalog.json
├── engineering/
│   └── POL-ENG-001-software-change-standard.md
├── security/
│   └── POL-SEC-001-secure-coding-standard.md
├── testing/
│   └── POL-TST-001-testing-standard.md
├── api/
│   └── POL-API-001-http-api-standard.md
├── frontend/
│   └── POL-UI-001-frontend-quality-standard.md
├── operations/
│   └── POL-OPS-001-observability-and-errors.md
└── data/
    └── POL-DAT-001-application-data-handling.md
```

### 3.1 Policy Controls Matrix

| Policy ID | Title | Key Controls | Verifiable Code Artifacts |
|---|---|---|---|
| `POL-ENG-001` | Software Change Standard | `ENG-001`: Acceptance criteria<br>`ENG-002`: Bounded scope<br>`ENG-003`: Dependency justification<br>`ENG-004`: Environment configuration<br>`ENG-005`: Documentation update | PR description, package.json, diff scope, README.md |
| `POL-SEC-001` | Secure Coding Standard | `SEC-001`: External input validation<br>`SEC-002`: Server-side authorisation<br>`SEC-003`: No committed secrets<br>`SEC-004`: Safe error responses<br>`SEC-005`: Safe query/command execution | Schema validation (Zod), status codes, git diff scan, sanitised error payloads |
| `POL-TST-001` | Testing Standard | `TST-001`: Automated test requirement<br>`TST-002`: Happy path coverage<br>`TST-003`: Negative/error path coverage<br>`TST-004`: Existing suite regression | Test files (`*.test.ts`), positive and negative test cases |
| `POL-API-001` | HTTP API Standard | `API-001`: Correct HTTP methods<br>`API-002`: Explicit status codes<br>`API-003`: Structured JSON envelopes<br>`API-004`: Payload validation<br>`API-005`: No internal stack leaks | Route handler methods, responses (`201`, `400`, `500`), JSON schemas |
| `POL-UI-001` | Frontend Quality Standard | `UI-001`: Accessible input labels<br>`UI-002`: Native keyboard accessibility<br>`UI-003`: Loading, success, error states<br>`UI-004`: Responsive layout support<br>`UI-005`: Dual validation (server authoritative) | Accessible JSX markup (`<label for="...">`), state hooks, CSS breakpoints |
| `POL-OPS-001` | Observability & Errors | `OPS-001`: Deliberate error handling<br>`OPS-002`: Sanitised logging (no PII/tokens)<br>`OPS-003`: Structured diagnostic logs<br>`OPS-004`: Remote client timeouts<br>`OPS-005`: Bounded retry loops | Try/catch blocks, logger statements, fetch timeout configurations |
| `POL-DAT-001` | Application Data Handling | `DAT-001`: Field classification<br>`DAT-002`: Data minimisation<br>`DAT-003`: No sensitive data in logs<br>`DAT-004`: Retention/storage documentation<br>`DAT-005`: Third-party data egress notice | Schema declarations, form field counts, log scrubbing |

---

## 4. Test Repository Guide (`../governance-agent-demo-app`)

A separate public repository is used for demonstration and eval verification.

### 4.1 Target Specification
- **Stack**: Next.js App Router, TypeScript, pnpm, Vitest, ESLint.
- **Feature Brief**: Customer feedback submission form with email and message fields, submitting to `/api/feedback`.

### 4.2 Branch and Pull Request Layout

```
main (baseline app, no feedback feature)
  │
  ├── demo/feedback-non-compliant (PR #1: initial submission with violations)
  │     │
  │     └── [Fast-forward update] ──> (PR #1 updated with fixes)
  │
  └── demo/feedback-compliant (Reference compliant implementation)
```

### 4.3 Intentional Violations vs Compliance

| Feature Concern | Non-Compliant Branch (`demo/feedback-non-compliant`) | Compliant Branch (`demo/feedback-compliant`) | Relevant Controls |
|---|---|---|---|
| Input Validation | Direct consumption of `request.json()` without schema check. | Strict Zod schema validating email format and length limits. | `SEC-001`, `API-004` |
| Logging | `console.log("Feedback received:", body)` logging raw email. | Metadata-only log: `console.info("Feedback received", { length })`. | `DAT-003`, `OPS-002` |
| Error Leakage | Returns caught `error.message` or stack directly to client. | Generic error message (`"Invalid request"`) with HTTP 400/500. | `SEC-004`, `API-005` |
| Automated Tests | Single test testing 200 OK. No failure cases. | Tests covering: valid payload (201), invalid email (400), empty message (400). | `TST-001`, `TST-002`, `TST-003` |
| UI Accessibility | `<input placeholder="Email">` without associated `<label>`. | Associated `<label htmlFor="email">` with keyboard-friendly focus. | `UI-001`, `UI-002` |

---

## 5. Detailed Implementation Checklist

### Phase 1: Storage and Sandbox Foundations
- [x] **1.1 Vercel Blob Integration**
  - [x] Add `@vercel/blob` to `package.json`.
  - [x] Author `agent/lib/documents/storage.ts` with typed helpers (`saveCaseDocument`, `readCaseDocument`, `saveVerificationReport`).
  - [x] Implement key derivation based on root session ID: `governance-demo/runs/<sessionId>/...`.
- [x] **1.2 Policy Taxonomy and Workspace Seeding**
  - [x] Create `agent/sandbox/sandbox.ts` with `defaultBackend()` and shared workspace configuration.
  - [x] Seed `agent/sandbox/workspace/policies/catalog.json`.
  - [x] Author all 7 Markdown policy standards with normative requirements and verification methods.
  - [x] Add directory `.gitkeep` files for `cases/` and `repositories/`.

### Phase 2: Drafter Station
- [x] **2.1 Drafter Subagent Definition**
  - [x] Author `agent/subagents/drafter/agent.ts` with `outputSchema` enforcing structured discovery metrics.
  - [x] Configure `agent/subagents/drafter/sandbox.ts` to inherit the parent sandbox.
- [x] **2.2 Drafter Tools**
  - [x] Author `agent/subagents/drafter/tools/save_document.ts` providing Blob persistence.
- [x] **2.3 Drafter Instructions**
  - [x] Author `agent/subagents/drafter/instructions.md` mandating catalog-first policy traversal, requirement extraction, and multi-document generation.

### Phase 3: Verifier Station
- [x] **3.1 Verifier Subagent Definition**
  - [x] Author `agent/subagents/verifier/agent.ts` with `outputSchema` capturing requirement-by-requirement verdicts and blocking findings.
  - [x] Configure `agent/subagents/verifier/sandbox.ts` to inherit the parent sandbox.
- [x] **3.2 Verifier Tools**
  - [x] Author `agent/subagents/verifier/tools/read_document.ts` to fetch approved assurance requirements.
  - [x] Author `agent/subagents/verifier/tools/save_verification_report.ts` to persist timestamped audit reports.
- [x] **3.3 Verifier Instructions**
  - [x] Author `agent/subagents/verifier/instructions.md` with git clone/fetch instructions, diff inspection discipline, and evidence citation standards.

### Phase 4: Root Orchestration & Channel Flow
- [x] **4.1 Root Instructions and State Coordination**
  - [x] Author `agent/instructions.md` with stage routing (Intake -> Drafter -> HITL Pause -> Verifier -> Loop).
  - [x] Configure `ask_question` invocation for document approval and pull request URL collection.
  - [x] Configure revision tracking and the 3-attempt failure threshold.
- [x] **4.2 Agent Model Configuration**
  - [x] Verify `agent/agent.ts` model settings, output limits, and compaction thresholds.

### Phase 5: Test Repository & Documentation
- [x] **5.1 Test App Guidance**
  - [x] Author `docs/demo-repository.md` containing complete scaffolding instructions, code samples for both branches, and testing workflows.
- [x] **5.2 Root Documentation Update**
  - [x] Update `README.md` to reflect architecture, local testing instructions, and operational safeguards.
- [x] **5.3 Anonymity and Neutrality Scan**
  - [x] Run automated scan across all repository files to guarantee strict neutrality.

---

## 6. Execution Rules During Implementation

1. **Mandatory Sub-Agents**: Never remove, bypass, or merge `drafter` or `verifier` sub-agents. Both stations are required architectural pillars for separation of duties.
2. **Blocking Sub-Agent Execution**: Sub-agent delegation must block until completion. The coordinator must not emit interim messages claiming work is running in the background; it must wait for the sub-agent to finish its work, create the files, and return the structured response before communicating with the user.
3. **Physical File Creation**: Ensure `drafter` actually writes the 4 assurance documents and `verifier` actually writes the verification reports prior to returning completion.
4. **Check off items sequentially**: Update this `PLAN.md` file after completing each milestone. Commit after each phase.
5. **Preserve Anonymity**: Ensure zero occurrences of proprietary partner names, personal names, or non-public event dates.
6. **Keep Code Simple**: Prefer standard Node.js and Eve built-ins over external dependencies.
7. **Tone and Conventions**: Use Australian spelling (e.g. *behaviour*, *optimise*), no em dashes, and concise documentation.
