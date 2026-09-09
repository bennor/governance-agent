# Governance Agent

An agentic change-management and release assurance system built on the [Eve](https://eve.dev) framework to make regulated software releases faster, safer, and auditable.

The governance agent assists software engineering teams by:
1. Translating feature intake prompts into structured compliance and assurance artefacts based on internal engineering standards.
2. Storing versioned assurance baselines in durable object storage (Vercel Blob).
3. Enforcing an explicit human-in-the-loop (HITL) review checkpoint before implementation audit begins.
4. Auditing pull requests in public GitHub repositories against the approved assurance baseline.
5. Providing actionable remediation guidance and supporting an iterative re-verification loop.

---

## Architecture Overview

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

### Component Roles

- **Root Coordinator (`agent/instructions.md`)**: Orchestrates the multi-stage governance lifecycle and manages session state. It coordinates the mandatory specialist sub-agents, halts at the HITL approval checkpoint via `ask_question`, collects the GitHub pull request URL, and runs the remediation loop. The coordinator operates a blocking execution model: it delegates to sub-agents, blocks until the sub-agent completes its work and returns its response, and only then presents complete results to the operator (never emitting premature interim status messages or running sub-agent tasks as unmonitored background jobs).
- **Drafter Station Sub-Agent (`agent/subagents/drafter/`)**: **Mandatory sub-agent**. Traverses the policy catalog, determines applicability, extracts normative requirements, and actually creates and persists all four assurance artefacts (`change-design.md`, `security-and-data-review.md`, `implementation-requirements.md`, and `policy-applicability.md`) before finishing.
- **Verifier Station Sub-Agent (`agent/subagents/verifier/`)**: **Mandatory sub-agent**. Clones the public pull request into the sandbox, loads approved requirements, audits code diffs with line-level evidence, saves versioned reports (`verification-report-attempt-N.md`), and returns an authoritative verdict (`compliant`, `non_compliant`, or `unable_to_verify`) before completing.
- **Shared Sandbox (`agent/sandbox/`)**: Provides an isolated execution environment containing seeded policies, cloned repositories, and working directories, shared between coordinator and subagents.

> **Architectural Requirement**: Sub-agents (`drafter` and `verifier`) are strictly required components of this architecture and must not be removed, bypassed, or merged into the coordinator at any point. Separation of duties between baseline drafting and independent code verification is foundational to the release assurance model. Furthermore, execution must block during sub-agent delegation so that documents and reports are fully generated before control returns to the operator.

---

## Policy Taxonomy

Normative standards are organised under `agent/sandbox/workspace/policies/` with an indexed `catalog.json`:

| Policy ID | Title | Key Controls |
|---|---|---|
| `POL-ENG-001` | Software Change Standard | `ENG-001` Acceptance criteria, `ENG-002` Bounded scope, `ENG-003` Dependencies, `ENG-004` Environment config, `ENG-005` Docs |
| `POL-SEC-001` | Secure Coding Standard | `SEC-001` Input validation, `SEC-002` Server authorisation, `SEC-003` No secrets, `SEC-004` Error sanitisation, `SEC-005` Safe queries |
| `POL-TST-001` | Testing Standard | `TST-001` Automated tests, `TST-002` Happy path coverage, `TST-003` Negative error coverage, `TST-004` Regression integrity |
| `POL-API-001` | HTTP API Standard | `API-001` HTTP methods, `API-002` Explicit status codes, `API-003` JSON envelopes, `API-004` Schema validation, `API-005` Stack redaction |
| `POL-UI-001` | Frontend Quality Standard | `UI-001` Form labels, `UI-002` Keyboard navigation, `UI-003` Feedback states, `UI-004` Responsive layout, `UI-005` Dual validation |
| `POL-OPS-001` | Observability & Errors | `OPS-001` Deliberate error handling, `OPS-002` Sanitised logs, `OPS-003` Structured logs, `OPS-004` Client timeouts, `OPS-005` Bounded retries |
| `POL-DAT-001` | Application Data Handling | `DAT-001` Classification, `DAT-002` Data minimisation, `DAT-003` No PII in logs, `DAT-004` Retention docs, `DAT-005` Egress notice |

---

## Getting Started

### Prerequisites

- Node.js 24.x
- pnpm 11+
- Vercel account with Blob storage configured (for durable storage)

### Local Development

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run type checking:
   ```bash
   pnpm run typecheck
   ```

3. Launch the web development server (Next.js with integrated Eve agent):
   ```bash
   pnpm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to interact with the governance agent via the browser UI.

4. Alternatively, launch the Eve CLI development TUI:
   ```bash
   pnpm run dev:eve
   ```

---

## Verification & Demo Repository

To test the governance agent against real pull requests with intentional violations and compliant fixes, refer to the [Test Repository Guide](docs/demo-repository.md).

---

## Implementation Plans

- [Phase 1 Implementation Plan](PLAN.md): Architecture baseline, storage foundations, drafter and verifier sub-agents, and HITL verification lifecycle.
- [Phase 2 Implementation Plan](PHASE_TWO_PLAN.md): Interactive web portal, dedicated chat route, deterministic workflow orchestration via `defineWorkflowTool`, and React Flow state graph.

---

## Operational Safeguards

- **Mandatory Sub-Agents**: The specialist sub-agents (`drafter` and `verifier`) are permanently required architecture components and must not be removed or merged. They enforce rigorous separation of duties between policy analysis and code verification.
- **Blocking Sub-Agent Execution**: Delegation to sub-agents is strictly synchronous and blocking from the operator's perspective. The coordinator halts and waits for the sub-agent to complete its tasks (including physical file generation) before responding to the user, eliminating premature "background job" acknowledgments.
- **Sandboxed Execution**: Shell commands, git clones, and code inspections run exclusively within the sandbox, never in the application host environment.
- **Human-in-the-Loop Gating**: Automated code review cannot commence until a human operator reviews and explicitly approves the drafted assurance baseline.
- **Durable Audit Trail**: All assurance artefacts and versioned verification reports are stored immutably in Vercel Blob keyed by the root session identifier.
- **Bounded Remediation Loop**: The iteration loop enforces a maximum of 3 verification attempts per case before requiring formal escalation.
