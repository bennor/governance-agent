# POL-DAT-001: Application Data Handling Standard

## 1. Policy Identification
- **Identifier**: POL-DAT-001
- **Title**: Application Data Handling Standard
- **Category**: Data
- **Version**: 1.0.0
- **Status**: Approved

## 2. Objective and Scope
This standard specifies principles for data classification, privacy protection, data minimisation, and data handling in web applications. It governs how customer data, personal information, and transactional payloads are collected, logged, and transferred.

## 3. Normative Controls

### DAT-001: Data Field Classification
- **Requirement**: Schemas, interfaces, and data models handling user information must identify the classification level of fields (such as Public, Internal, Personal Identifiable Information (PII), or Restricted).
- **Rationale**: Lack of data classification leads to inadvertent exposure of sensitive user records across downstream systems.
- **Verification Method**: Inspect data definitions and schemas in route handlers and components. Check that personal data fields (e.g. email, phone, address) are treated as sensitive throughout the request lifecycle.

### DAT-002: Data Minimisation
- **Requirement**: Forms, endpoints, and data ingestion services must collect only the minimum set of data fields required to complete the specific business action. Speculative collection of unnecessary personal data is prohibited.
- **Rationale**: Excessive data collection increases regulatory liability and exposure severity in security incidents.
- **Verification Method**: Compare form fields and schema definitions against feature requirements. Verify that every collected field serves a direct, documented functional purpose.

### DAT-003: No Sensitive Data in Logs
- **Requirement**: Personal Identifiable Information (such as email addresses, telephone numbers, home addresses, government identifiers) must never be written to application logs, system output, or error messages.
- **Rationale**: Logging PII violates data protection regulations (such as GDPR, CCPA, and Australian Privacy Principles) and exposes user identities to all log consumers.
- **Verification Method**: Search code diffs for logging calls. Verify that no personal data fields (specifically email addresses, names, or raw request payloads containing them) are printed to the console or loggers. Confirm that loggers emit only non-sensitive metadata (such as record counts, payload byte sizes, or anonymous status flags).

### DAT-004: Retention and Storage Documentation
- **Requirement**: Any persistent storage of user submissions or transactions must specify retention timelines, storage destination, and deletion or cleanup mechanisms.
- **Rationale**: Indefinite data retention without business necessity violates regulatory standards.
- **Verification Method**: Check whether persistent databases, queues, or blobs document retention periods and disposal procedures.

### DAT-005: Third-Party Data Egress Notice
- **Requirement**: Transmitting application or customer data to external third-party services (such as third-party analytics, third-party notification vendors, or AI APIs) must be declared and reviewed for privacy compliance.
- **Rationale**: Unreviewed third-party data transmission introduces cross-border data transfer risks and contractual non-compliance.
- **Verification Method**: Review network calls in route handlers. Verify whether external endpoints receive user data and confirm compliance with privacy notices.

## 4. Remediation Guidance
- Never pass raw user email addresses to `console.log`.
- Restrict feedback and intake forms to only the necessary fields (e.g. email and feedback message).
