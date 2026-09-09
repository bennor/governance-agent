# POL-TST-001: Testing Standard

## 1. Policy Identification
- **Identifier**: POL-TST-001
- **Title**: Testing Standard
- **Category**: Testing
- **Version**: 1.0.0
- **Status**: Approved

## 2. Objective and Scope
This standard establishes minimum test automation requirements for all functional code changes. It ensures code reliability, prevents regression, and verifies both correct operation and resilient error handling under adverse inputs.

## 3. Normative Controls

### TST-001: Automated Test Requirement
- **Requirement**: Every pull request introducing new features, route handlers, or user interactions must include corresponding automated test files (`*.test.ts`, `*.spec.ts`, or equivalent) executable via the project test script (such as `vitest run` or `pnpm test`).
- **Rationale**: Manual verification does not provide a durable safeguard against regressions across subsequent releases.
- **Verification Method**: Check the pull request diff for test files. Confirm that test files exist in the diff and test the newly introduced code paths.

### TST-002: Happy Path Test Coverage
- **Requirement**: Automated tests must execute the primary successful execution path (happy path) and assert the expected response payload, HTTP status code (e.g. 200 or 201), and any persistent state side-effects.
- **Rationale**: Demonstrates that the feature achieves its basic intended business purpose under valid input.
- **Verification Method**: Review test cases in the test file. Identify tests providing valid inputs and asserting success outcomes and status codes.

### TST-003: Negative and Error Path Coverage
- **Requirement**: Automated tests must explicitly exercise error conditions, boundary rejections, missing required fields, and malformed inputs. Tests must assert that the application cleanly rejects invalid requests with appropriate error codes (e.g. 400 Bad Request) rather than crashing or returning unexpected status codes.
- **Rationale**: Testing only success conditions leaves validation vulnerabilities and failure states unverified.
- **Verification Method**: Review test cases for explicit invalid inputs (e.g. invalid email format, empty required fields, oversized payloads) and verify that assertions expect HTTP 400 status codes and formatted error messages.

### TST-004: Regression Suite Integrity
- **Requirement**: Pull requests must maintain the integrity of the existing test suite. Modifying existing tests is permitted only when intentionally altering business specifications, and deleting existing test files or skipping tests (`test.skip`) without approved justification is strictly prohibited.
- **Rationale**: Deleting or disabling existing tests masks regressions and degrades test confidence over time.
- **Verification Method**: Inspect test diffs to confirm no tests have been commented out, deleted, or annotated with `.skip`. Run the automated test suite if sandbox dependencies permit.

## 4. Remediation Guidance
- If a pull request lacks test files, author a test file exercising the new route or component.
- If tests only cover valid submissions, add test cases asserting rejection of invalid or empty data fields with HTTP 400.
