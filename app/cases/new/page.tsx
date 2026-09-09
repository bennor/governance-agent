"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileCode2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { PortalNavigation } from "@/app/_components/portal-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function NewCasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [technicalScope, setTechnicalScope] = useState("");
  const [dataClassification, setDataClassification] = useState<
    "none" | "internal" | "pii" | "confidential"
  >("none");
  const [pullRequestUrl, setPullRequestUrl] = useState("");

  const handleLoadDemo = () => {
    setTitle("Customer Feedback Submission API & Form");
    setSummary(
      "Enable end-users to submit product feedback and ratings directly through an accessible frontend form and secure Next.js API route."
    );
    setTechnicalScope(
      "Next.js App Router route handler at /api/feedback, Zod schema validation, email sanitisation, client feedback states, and automated Vitest tests."
    );
    setDataClassification("pii");
    setPullRequestUrl("");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !technicalScope.trim()) {
      setErrorMessage("Please complete all required fields (title, summary, and technical scope).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const intake = {
      title: title.trim(),
      summary: summary.trim(),
      technicalScope: technicalScope.trim(),
      dataClassification,
      pullRequestUrl: pullRequestUrl.trim() || undefined,
    };

    // Construct message with the opt-in deterministic workflow tag
    const message = `[Deterministic Workflow] Please run a release governance assessment for this feature intake:\n\n${JSON.stringify(
      intake,
      null,
      2
    )}`;

    try {
      const response = await fetch("/eve/v1/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create governance session: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const sessionId =
        data.sessionId ||
        response.headers.get("eve-session-id") ||
        (typeof data.id === "string" ? data.id : null);

      if (!sessionId) {
        throw new Error("No session identifier returned by the Eve runtime.");
      }

      router.push(`/cases/${encodeURIComponent(sessionId)}`);
    } catch (err) {
      console.error("Intake submission error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to start governance session. Please ensure the Eve agent is running."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PortalNavigation />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Governance Case</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Submit feature specifications for deterministic policy drafting, HITL baseline approval, and pull request verification.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadDemo}
            className="gap-1.5 text-xs h-8 shrink-0"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Load Demo Feedback Prompt</span>
          </Button>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Submission Failed</p>
              <p className="mt-0.5 text-xs opacity-90">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Change Specification Intake</CardTitle>
            <CardDescription className="text-xs">
              This information will be passed to the specialist Drafter station to establish the four normative assurance artefacts.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature Title <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  placeholder="e.g. Customer Feedback Submission API"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="summary" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Business Purpose & Context <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="summary"
                  placeholder="Describe the problem being solved and user value..."
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="scope" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Technical Scope & Architecture <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="scope"
                  placeholder="Endpoints, schemas, UI components, state management, test strategy..."
                  rows={4}
                  value={technicalScope}
                  onChange={(e) => setTechnicalScope(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="classification" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data Classification
                  </label>
                  <select
                    id="classification"
                    value={dataClassification}
                    onChange={(e) =>
                      setDataClassification(
                        e.target.value as "none" | "internal" | "pii" | "confidential"
                      )
                    }
                    disabled={isSubmitting}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="none" className="bg-background">None (No user or private data)</option>
                    <option value="internal" className="bg-background">Internal (Non-sensitive operational data)</option>
                    <option value="pii" className="bg-background">PII (Personal Identifiable Information e.g. emails)</option>
                    <option value="confidential" className="bg-background">Confidential (Credentials or payment data)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="prUrl" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Public GitHub Pull Request URL <span className="text-muted-foreground font-normal">(Optional now)</span>
                  </label>
                  <Input
                    id="prUrl"
                    placeholder="https://github.com/owner/repo/pull/1"
                    value={pullRequestUrl}
                    onChange={(e) => setPullRequestUrl(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span>Runs deterministic state machine via Workflow tool</span>
                </div>

                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Initialising Case...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit & Establish Case</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
