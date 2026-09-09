# POL-ENG-001: Software Change Standard

## 1. Policy Identification
- **Identifier**: POL-ENG-001
- **Title**: Software Change Standard
- **Category**: Engineering
- **Version**: 1.0.0
- **Status**: Approved

## 2. Objective and Scope
This standard defines baseline requirements for software modifications, scope management, dependency additions, configuration hygiene, and technical documentation across all internal software repositories. It applies to all pull requests introducing new features, bug fixes, or architectural refactorings.

## 3. Normative Controls

### ENG-001: Acceptance Criteria Definition
- **Requirement**: Every software change submitted for verification must possess explicit, testable functional acceptance criteria documented in the pull request description or accompanying design artefact.
- **Rationale**: Unclear acceptance criteria lead to scope misalignment and untestable delivery.
- **Verification Method**: Inspect the pull request description and commit history. Confirm that criteria describing expected behaviour under both valid and invalid conditions are clearly stated.

### ENG-002: Bounded Change Scope
- **Requirement**: Modifications within a pull request must be tightly bounded to the declared functional change. Unrelated code clean-ups, speculative features, or cross-cutting structural reorganisations must be submitted in separate changes.
- **Rationale**: Diff inflation obscures review, introduces hidden regressions, and complicates automated audit trails.
- **Verification Method**: Review `git diff --stat` and file paths. Check that every touched file directly contributes to the stated objective without extraneous file modifications.

### ENG-003: Dependency Justification
- **Requirement**: Any newly added package dependency (in `package.json` or equivalent package manifest) must be minimal, actively maintained, free of known high or critical vulnerabilities, and accompanied by written justification in the pull request.
- **Rationale**: Unnecessary third-party packages increase supply-chain risk and maintenance burden.
- **Verification Method**: Check diffs in `package.json` and lockfiles. Verify whether any new dependencies appear and confirm whether justification is present in the pull request description.

### ENG-004: Environment Configuration Isolation
- **Requirement**: Dynamic configuration values, service URLs, database connection details, and operational flags must be sourced through environment variables rather than hardcoded string literals.
- **Rationale**: Hardcoded configuration prevents reproducible deployments and risks environment leakage.
- **Verification Method**: Inspect source files for hardcoded endpoints, credentials, or environment-specific values. Verify use of `process.env` or dedicated configuration modules.

### ENG-005: Documentation Maintenance
- **Requirement**: Changes that introduce or modify user-facing interfaces, public API routes, operational workflows, or environment variables must update corresponding repository documentation (e.g. `README.md` or API documentation).
- **Rationale**: Stale documentation creates developer confusion and operational downtime.
- **Verification Method**: If new routes or components are added, verify whether repository documentation or schema documentation was updated in the same change.

## 4. Remediation Guidance
- If acceptance criteria are missing, update the pull request description with structured acceptance points.
- If unrelated files were touched, revert the extra modifications and open a separate pull request.
- If dependencies were added without note, explain their necessity or replace them with native platform capabilities.
