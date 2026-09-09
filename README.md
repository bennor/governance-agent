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

- **Root Coordinator (`agent/instructions.md`)**: Orchestrates the multi-stage governance lifecycle, manages session state, halts at the HITL approval checkpoint via `ask_question`, collects the GitHub pull request URL, and runs the remediation loop.
- **Drafter Station (`agent/subagents/drafter/`)**: Traverses the policy catalog, determines applicability, extracts normative requirements, and generates four assurance artefacts (`change-design.md`, `security-and-data-review.md`, `implementation-requirements.md`, and `policy-applicability.md`).
- **Verifier Station (`agent/subagents/verifier/`)**: Clones the public pull request into the sandbox, loads approved requirements from Blob, audits code diffs with line-level evidence, saves versioned reports (`verification-report-attempt-N.md`), and returns an authoritative verdict (`compliant`, `non_compliant`, or `unable_to_verify`).
- **Shared Sandbox (`agent/sandbox/`)**: Provides an isolated execution environment containing seeded policies, cloned repositories, and working directories, shared between coordinator and subagents.

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

## Operational Safeguards

- **Sandboxed Execution**: Shell commands, git clones, and code inspections run exclusively within the sandbox, never in the application host environment.
- **Human-in-the-Loop Gating**: Automated code review cannot commence until a human operator reviews and explicitly approves the drafted assurance baseline.
- **Durable Audit Trail**: All assurance artefacts and versioned verification reports are stored immutably in Vercel Blob keyed by the root session identifier.
- **Bounded Remediation Loop**: The iteration loop enforces a maximum of 3 verification attempts per case before requiring formal escalation.
