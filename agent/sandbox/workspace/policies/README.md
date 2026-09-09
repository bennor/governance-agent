# Engineering Policy Repository

This directory contains the normative engineering, architecture, and governance standards enforced by the governance agent.

## Directory Structure

- `catalog.json`: Machine-readable index of all policies, categories, control identifiers, and verification keywords.
- `engineering/`: Baseline software delivery, dependency management, and change standards.
- `security/`: Secure coding, input validation, secret management, and access control standards.
- `testing/`: Automated test suite requirements, test coverage depth, and regression standards.
- `api/`: HTTP API standards, status codes, payload structures, and error handling.
- `frontend/`: User interface accessibility, state management, validation, and design standards.
- `operations/`: Observability, logging hygiene, error boundaries, and reliability standards.
- `data/`: Data classification, privacy, minimisation, and data handling requirements.

## Evaluation Process

1. **Intake & Applicability**: During the change intake phase, the Drafter examines `catalog.json` and determines which policies and controls apply to the requested feature.
2. **Assurance Baseline**: The Drafter extracts normative requirements into `implementation-requirements.md` and related artefacts.
3. **Audit & Verification**: During the verification phase, the Verifier audits the pull request diff against the extracted controls and evaluates compliance with file and line evidence.
