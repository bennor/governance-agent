# Test Repository Guide: `governance-agent-demo-app`

This guide explains how to scaffold and configure the demonstration repository used to test and evaluate the Governance Agent.

## 1. Overview and Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Test Runner**: Vitest
- **Validation**: Zod
- **Styling**: Tailwind CSS

The demo app implements a simple Customer Feedback feature:
- Frontend page: `/feedback` with input fields for user email and message.
- API route: `POST /api/feedback` accepting JSON payloads.

---

## 2. Repository Layout and Branches

```
main (baseline Next.js application, no feedback feature)
  │
  ├── demo/feedback-non-compliant (Initial PR submission with policy violations)
  │     │
  │     └── [Remediation Push] ──> (PR updated with compliant fixes)
  │
  └── demo/feedback-compliant (Reference compliant implementation)
```

---

## 3. Scaffolding the Baseline (`main` branch)

1. Create a clean Next.js project:
   ```bash
   pnpm create next-app governance-agent-demo-app --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
   cd governance-agent-demo-app
   ```

2. Add testing and validation dependencies:
   ```bash
   pnpm add zod
   pnpm add -D vitest @vitejs/plugin-react
   ```

3. Configure Vitest in `vitest.config.ts`:
   ```ts
   import { defineConfig } from "vitest/config";
   import react from "@vitejs/plugin-react";
   import path from "node:path";

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: "node",
     },
     resolve: {
       alias: {
         "@": path.resolve(__dirname, "./"),
       },
     },
   });
   ```

4. Add test script to `package.json`:
   ```json
   "scripts": {
     "test": "vitest run"
   }
   ```

5. Commit baseline to `main` and push to your public GitHub repository:
   ```bash
   git add .
   git commit -m "Initialize baseline application"
   git remote add origin https://github.com/<owner>/governance-agent-demo-app.git
   git push -u origin main
   ```

---

## 4. Branch 1: Non-Compliant Implementation (`demo/feedback-non-compliant`)

Create and checkout the branch:
```bash
git checkout -b demo/feedback-non-compliant
```

### 4.1 Route Handler: `app/api/feedback/route.ts`

This version intentionally violates:
- `SEC-001` & `API-004`: Direct consumption of unvalidated request JSON without schema check.
- `DAT-003` & `OPS-002`: Logs user email (PII) directly to console.
- `SEC-004` & `API-005`: Leaks raw exception message to the client.
- `API-002`: Returns generic status instead of semantic 201 Created.

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // VIOLATION (SEC-001, API-004): No schema validation
    const body = await request.json();

    // VIOLATION (DAT-003, OPS-002): Logging raw PII (email address)
    console.log("Feedback received from user:", body);

    // Business action simulation
    const feedback = {
      id: "fb_123",
      email: body.email,
      message: body.message,
      createdAt: new Date().toISOString(),
    };

    // VIOLATION (API-002): Returns 200 instead of 201 Created
    return NextResponse.json({ success: true, data: feedback });
  } catch (error: any) {
    // VIOLATION (SEC-004, API-005): Internal error message leaked to client
    return NextResponse.json(
      { error: error?.message || "Internal failure" },
      { status: 500 }
    );
  }
}
```

### 4.2 Frontend Page: `app/feedback/page.tsx`

This version intentionally violates:
- `UI-001`: Form inputs lack `<label>` elements, relying solely on placeholder text.
- `UI-003`: Missing loading states and disabled button during active submission.

```tsx
"use client";

import { useState } from "react";

export default function FeedbackPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, message }),
    });
    setSubmitted(true);
  };

  return (
    <main className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Customer Feedback</h1>
      {submitted ? (
        <p>Thank you for your feedback.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* VIOLATION (UI-001): No <label> element */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="border p-2 rounded"
          />

          {/* VIOLATION (UI-001): No <label> element */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message"
            className="border p-2 rounded"
          />

          {/* VIOLATION (UI-003): No loading indicator or disabled state */}
          <button type="submit" className="bg-blue-600 text-white p-2 rounded">
            Submit Feedback
          </button>
        </form>
      )}
    </main>
  );
}
```

### 4.3 Automated Tests: `app/api/feedback/route.test.ts`

This version intentionally violates:
- `TST-003`: Lacks negative test coverage. Only verifies the valid happy path.

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/feedback (non-compliant suite)", () => {
  it("submits feedback successfully", async () => {
    const request = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        message: "Great product!",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });
});
```

Push the branch and open Pull Request #1 on GitHub:
```bash
git add .
git commit -m "feat: add customer feedback submission"
git push -u origin demo/feedback-non-compliant
```

---

## 5. Branch 2: Compliant Implementation (`demo/feedback-compliant`)

Create and checkout the compliant branch:
```bash
git checkout main
git checkout -b demo/feedback-compliant
```

### 5.1 Route Handler: `app/api/feedback/route.ts`

Complies with:
- `SEC-001` & `API-004`: Strict schema validation via Zod with length limits.
- `API-002`: Returns HTTP 201 Created on success, HTTP 400 Bad Request on invalid input.
- `DAT-003` & `OPS-002`: Metadata-only logging without email addresses.
- `SEC-004` & `API-005`: Sanitised, generic client error response with details withheld.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

const feedbackSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(2000),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);

    // COMPLIANT (SEC-001, API-004): Strict schema validation
    const parsed = feedbackSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.flatten().fieldErrors,
        },
        // COMPLIANT (API-002): Explicit 400 Bad Request
        { status: 400 }
      );
    }

    const { email, message } = parsed.data;

    // COMPLIANT (DAT-003, OPS-002): Metadata-only logging, no PII
    console.info("Feedback received", {
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    });

    const feedback = {
      id: "fb_123",
      email,
      message,
      createdAt: new Date().toISOString(),
    };

    // COMPLIANT (API-002): Explicit 201 Created
    return NextResponse.json(
      { success: true, data: feedback },
      { status: 201 }
    );
  } catch (error) {
    // COMPLIANT (OPS-001, OPS-003): Internal structured log
    console.error("Unhandled feedback processing error", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    // COMPLIANT (SEC-004, API-005): Generic error envelope to client
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### 5.2 Frontend Page: `app/feedback/page.tsx`

Complies with:
- `UI-001`: Programmatic `<label htmlFor="...">` associated with matching input `id`.
- `UI-002`: Accessible keyboard navigation and focus management.
- `UI-003`: Distinct visual feedback for loading, success, and validation error.
- `UI-004`: Responsive layout with clean padding and container limits.
- `UI-005`: Displays server validation error feedback.

```tsx
"use client";

import { useState } from "react";

export default function FeedbackPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data?.error || "Submission failed");
        return;
      }

      setIsSuccess(true);
    } catch {
      setErrorMessage("Network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold mb-4">Customer Feedback</h1>

      {isSuccess ? (
        <div className="p-4 bg-green-50 text-green-800 rounded border border-green-200">
          Thank you for your feedback. Your submission has been recorded.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
              {errorMessage}
            </div>
          )}

          {/* COMPLIANT (UI-001): Associated <label> with htmlFor */}
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* COMPLIANT (UI-001): Associated <label> with htmlFor */}
          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-sm font-medium text-gray-700">
              Feedback Message
            </label>
            <textarea
              id="message"
              required
              minLength={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe your experience or suggestions..."
              rows={4}
              className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* COMPLIANT (UI-003): Loading indicator and disabled state */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded font-medium transition"
          >
            {isSubmitting ? "Submitting feedback..." : "Submit Feedback"}
          </button>
        </form>
      )}
    </main>
  );
}
```

### 5.3 Automated Tests: `app/api/feedback/route.test.ts`

Complies with:
- `TST-001`: Automated test suite in place.
- `TST-002`: Happy path coverage asserting 201 Created.
- `TST-003`: Explicit negative error cases (invalid email, empty message) asserting 400 Bad Request.

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/feedback", () => {
  it("returns 201 Created for valid payload (happy path)", async () => {
    const request = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "customer@example.com",
        message: "Excellent customer experience.",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.email).toBe("customer@example.com");
  });

  it("returns 400 Bad Request when email format is invalid", async () => {
    const request = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        message: "Valid feedback message content.",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid request payload");
    expect(json.details?.email).toBeDefined();
  });

  it("returns 400 Bad Request when message is too short", async () => {
    const request = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "customer@example.com",
        message: "Hi",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid request payload");
    expect(json.details?.message).toBeDefined();
  });
});
```

Push compliant branch:
```bash
git add .
git commit -m "feat: implement compliant feedback submission"
git push -u origin demo/feedback-compliant
```

---

## 6. End-to-End Governance Evaluation Workflow

1. **Intake Phase**:
   - Provide intake prompt in Eve:
     `"We need to implement a customer feedback form with email and message inputs, submitting to /api/feedback."`
   - The Drafter station generates four assurance documents.
2. **HITL Review**:
   - Operator reviews documents and provides PR URL for PR #1 (`demo/feedback-non-compliant`).
3. **Attempt 1 (Non-Compliant)**:
   - Verifier station audits PR #1.
   - Generates `verification-report-attempt-1.md`.
   - Results in `verdict: "non_compliant"` with blocking findings for `SEC-001`, `DAT-003`, `SEC-004`, `TST-003`, and `UI-001`.
4. **Remediation Push**:
   - In the demo repository, update `demo/feedback-non-compliant` with the compliant code from `demo/feedback-compliant`:
     ```bash
     git checkout demo/feedback-non-compliant
     git merge --ff-only demo/feedback-compliant
     git push origin demo/feedback-non-compliant
     ```
5. **Attempt 2 (Compliant)**:
   - Operator tells the Governance Agent: `"Remediation commits pushed, please re-verify."`
   - Verifier audits updated PR #1.
   - Generates `verification-report-attempt-2.md`.
   - Results in `verdict: "compliant"` with zero blocking findings.
   - Governance Agent officially issues **APPROVED FOR PRODUCTION RELEASE**.
