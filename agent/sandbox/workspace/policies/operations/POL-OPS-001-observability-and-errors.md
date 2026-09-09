# POL-OPS-001: Observability and Errors Standard

## 1. Policy Identification
- **Identifier**: POL-OPS-001
- **Title**: Observability and Errors Standard
- **Category**: Operations
- **Version**: 1.0.0
- **Status**: Approved

## 2. Objective and Scope
This standard defines operational requirements for logging hygiene, structured diagnostics, error handling discipline, and network call resiliency. It applies to all application services, background tasks, and route handlers.

## 3. Normative Controls

### OPS-001: Deliberate Error Handling
- **Requirement**: Operations that can fail (network requests, JSON parsing, database operations, filesystem reads) must be enclosed in deliberate error handling structures (`try/catch` or explicit Result patterns). Unhandled promise rejections are prohibited.
- **Rationale**: Unhandled errors crash worker processes and cause silent failure cascades.
- **Verification Method**: Examine asynchronous calls and parsing routines. Confirm that appropriate `try/catch` blocks wrap operations prone to failure and return graceful fallbacks.

### OPS-002: Sanitised Logging
- **Requirement**: Application logs emitted to stdout, stderr, or external log collectors must never contain credentials, authentication headers, authorization bearer tokens, passwords, or personal identifiable information (PII) such as customer email addresses or phone numbers.
- **Rationale**: Centralised log aggregators are frequently accessible to broad engineering teams and represent a major exposure point for credential and privacy breaches.
- **Verification Method**: Search code diffs for `console.log`, `console.info`, `console.error`, and logger invocations. Verify that raw request bodies or customer identifiers (like email) are not passed directly to logger functions. Verify that logging records only metadata or sanitised identifiers (e.g. `{ length: message.length }` or `{ event: "feedback_received" }`).

### OPS-003: Structured Diagnostic Logs
- **Requirement**: Log statements should utilise structured attributes (key-value metadata or JSON objects) including action name, correlation identifier (where available), and error category, rather than unstructured multi-line string concatenations.
- **Rationale**: Structured logs enable automated parsing, metrics extraction, and rapid incident alerting.
- **Verification Method**: Verify that logger calls emit structured objects rather than concatenated strings.

### OPS-004: Remote Client Timeouts
- **Requirement**: Outbound network requests to external APIs, databases, or microservices must specify explicit execution deadlines and timeouts using `AbortSignal.timeout(ms)` or client-level timeout options.
- **Rationale**: Unbounded network requests tie up server connection pools and memory under downstream service degradation.
- **Verification Method**: Check outbound `fetch()` or client calls. Confirm that an `AbortSignal.timeout(...)` or explicit timeout parameter is configured.

### OPS-005: Bounded Retry Loops
- **Requirement**: Automated retries for transient failures must be strictly bounded with a maximum attempt limit (e.g. 3 attempts) and implement exponential backoff with jitter to avoid compounding server load.
- **Rationale**: Unbounded retries cause self-inflicted denial of service during downstream recovery.
- **Verification Method**: Inspect retry helper loops or queue consumers for explicit termination conditions.

## 4. Remediation Guidance
- Replace `console.log("Feedback received:", body)` with `console.info("Feedback received", { length: body.message?.length })` to avoid logging personal email addresses.
- Wrap external `fetch` calls with `signal: AbortSignal.timeout(5000)`.
