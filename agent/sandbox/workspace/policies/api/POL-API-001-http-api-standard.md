# POL-API-001: HTTP API Standard

## 1. Policy Identification
- **Identifier**: POL-API-001
- **Title**: HTTP API Standard
- **Category**: API
- **Version**: 1.0.0
- **Status**: Approved

## 2. Objective and Scope
This standard defines architecture and consistency requirements for HTTP API routes across web applications and backend services. It mandates proper verb usage, predictable HTTP status codes, structured JSON payloads, and clean error isolation.

## 3. Normative Controls

### API-001: Semantic HTTP Methods
- **Requirement**: Endpoints must adhere strictly to semantic HTTP method definitions: `GET` for safe, cacheable data retrieval without side-effects; `POST` for entity creation and non-idempotent submission; `PUT` or `PATCH` for modifications; and `DELETE` for removals.
- **Rationale**: Deviations from standard HTTP semantics break browser expectations, caching proxies, and API client conventions.
- **Verification Method**: Inspect route definitions (e.g. Next.js App Router `export async function POST(...)`). Confirm that state changes are bound to `POST`/`PUT`/`PATCH` rather than `GET`.

### API-002: Explicit Status Codes
- **Requirement**: All API responses must return explicit, semantically accurate HTTP status codes. Resource creation must return `201 Created` or `200 OK`; validation or client errors must return `400 Bad Request`; authentication failures must return `401 Unauthorized`; permission failures must return `403 Forbidden`; and internal failures must return `500 Internal Server Error`.
- **Rationale**: Returning HTTP 200 with error payloads or defaulting to inaccurate status codes disrupts client error handling.
- **Verification Method**: Examine `NextResponse.json(...)` or `Response.json(...)` invocations in the route handler. Confirm that `{ status: ... }` options are explicitly declared for all return paths.

### API-003: Structured JSON Envelopes
- **Requirement**: Responses emitted by API endpoints must use well-formed JSON envelopes. Success responses should provide consistent data structures, and error responses must provide structured error objects (such as `{ error: string, details?: ... }`).
- **Rationale**: Inconsistent response formats complicate client parsing and lead to unhandled frontend exceptions.
- **Verification Method**: Review response payload structures across success and failure branches. Confirm that both branches return structured JSON rather than bare text strings.

### API-004: Request Payload Validation
- **Requirement**: All incoming request bodies and query parameters must be validated using schema parsing before any business logic, database transaction, or external service call is triggered.
- **Rationale**: Unvalidated request payloads cause unexpected runtime exceptions and security vulnerabilities.
- **Verification Method**: Check that incoming JSON data is parsed and validated using a schema library (e.g. Zod `safeParse`) immediately following receipt.

### API-005: Internal Stack and Detail Redaction
- **Requirement**: Error responses returned to clients on 5xx or unhandled conditions must emit generic fault descriptions. Low-level runtime exceptions, internal module paths, database queries, and stack traces must be strictly redacted from client payloads.
- **Rationale**: Leaking runtime details exposes the internal implementation to potential attackers.
- **Verification Method**: Check catch blocks in API routes. Ensure that `error.stack` or raw `error` objects are never serialized into the client JSON response.

## 4. Remediation Guidance
- Ensure new creation endpoints return `{ status: 201 }` on success and `{ status: 400 }` on invalid input.
- Replace unstructured string responses like `new Response("Error")` with `NextResponse.json({ error: "Invalid request" }, { status: 400 })`.
