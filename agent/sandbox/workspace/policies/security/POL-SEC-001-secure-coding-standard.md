# POL-SEC-001: Secure Coding Standard

## 1. Policy Identification
- **Identifier**: POL-SEC-001
- **Title**: Secure Coding Standard
- **Category**: Security
- **Version**: 1.0.0
- **Status**: Approved

## 2. Objective and Scope
This standard mandates technical controls to protect application endpoints, business data, and system resources from common web application security risks. It applies to all server-side routes, API handlers, data parsing routines, and client-server communication channels.

## 3. Normative Controls

### SEC-001: External Input Validation
- **Requirement**: All untrusted external input (HTTP request bodies, URL query parameters, path arguments, and incoming headers) must be rigorously validated against a typed, strict schema (such as a Zod schema) before any business logic, storage, or execution takes place.
- **Rationale**: Direct consumption of unvalidated input leads to injection attacks, denial of service, data corruption, and prototype pollution.
- **Verification Method**: Inspect route handlers and entry points. Verify that incoming payloads (e.g. `await request.json()`) are explicitly parsed with a schema validator (such as `schema.safeParse` or `schema.parse`) before values are extracted. Look for unvalidated raw property access.

### SEC-002: Server-Side Authorisation
- **Requirement**: Protected operations, sensitive record lookups, and state-modifying actions must enforce authoritative server-side identity and permission checks. Client-supplied roles or assertions must never be trusted without cryptographic server verification.
- **Rationale**: Client-side authorisation can be bypassed by forged requests.
- **Verification Method**: Examine endpoints processing sensitive actions. Ensure authentication tokens or session contexts are verified on the server before data access.

### SEC-003: No Committed Secrets
- **Requirement**: Repository source code, commit history, test fixtures, and configuration files must never contain unencrypted secrets, private keys, API credentials, bearer tokens, or sensitive certificates.
- **Rationale**: Secrets committed to git repositories are easily compromised and difficult to purge completely.
- **Verification Method**: Scan the full git diff for patterns resembling API keys, private keys, authorization tokens, passwords, or hardcoded secrets.

### SEC-004: Safe Error Responses
- **Requirement**: In the event of validation failures, exceptions, or runtime faults, the server response must deliver safe, sanitised error envelopes. Internal stack traces, raw database error strings, environment details, or execution context must never be emitted to external clients.
- **Rationale**: Detailed error messages leak operational intelligence that attackers use to craft exploits.
- **Verification Method**: Inspect `catch` blocks and error response construction in route handlers. Verify that status codes are appropriate (e.g. 400 for bad request, 500 for internal error) and error payloads return generic error descriptions without `error.stack` or raw caught error objects.

### SEC-005: Safe Query and Command Execution
- **Requirement**: Any interaction with databases, external systems, or operating system shells must utilise parameterised interfaces, prepared statements, or strongly typed ORM constructs. Direct string interpolation or concatenation into command strings or query templates is prohibited.
- **Rationale**: String concatenation in queries is the primary vector for SQL injection and command injection vulnerabilities.
- **Verification Method**: Search code for dynamic string interpolation inside database query calls or child process executions.

## 4. Remediation Guidance
- If raw `request.json()` is consumed directly, define a strict schema using Zod, validate the input, and return HTTP 400 when validation fails.
- If error handlers emit `error.message` or `error.stack` to clients, sanitise the client response to `"Invalid request"` or `"Internal server error"`, and log detailed errors privately on the server.
