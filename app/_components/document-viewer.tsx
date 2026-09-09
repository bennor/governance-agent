"use client";

import { useState } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { FileText, Download, Copy, Check, Clock, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocumentItem {
  filename: string;
  title?: string;
  content?: string;
  blobUrl?: string;
}

interface DocumentViewerProps {
  caseId: string;
  documents: DocumentItem[];
  activeRevision?: number;
}

const DOCUMENT_TABS = [
  { id: "change-design.md", label: "Change Design" },
  { id: "security-and-data-review.md", label: "Security & Data" },
  { id: "implementation-requirements.md", label: "Requirements" },
  { id: "policy-applicability.md", label: "Policy Applicability" },
];

export function DocumentViewer({ caseId, documents, activeRevision = 1 }: DocumentViewerProps) {
  const [selectedDoc, setSelectedDoc] = useState(DOCUMENT_TABS[0].id);
  const [copied, setCopied] = useState(false);

  const docMap = new Map<string, DocumentItem>();
  for (const doc of documents) {
    docMap.set(doc.filename, doc);
  }

  const currentDoc = docMap.get(selectedDoc);

  const handleCopy = () => {
    if (currentDoc?.content) {
      navigator.clipboard.writeText(currentDoc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden h-[600px]">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="font-semibold text-xs tracking-tight">Assurance Baseline Documents</span>
          <Badge variant="outline" className="text-[10px] font-mono h-4">
            Revision {activeRevision}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {currentDoc?.content ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied" : "Copy Markdown"}</span>
            </Button>
          ) : null}

          {currentDoc?.blobUrl ? (
            <a
              href={currentDoc.blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md transition-colors"
            >
              <Download className="size-3.5" />
              <span>Vercel Blob</span>
            </a>
          ) : null}
        </div>
      </div>

      <Tabs value={selectedDoc} onValueChange={setSelectedDoc} className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border px-4 py-2 bg-background">
          <TabsList className="h-8 p-0.5 gap-1 bg-muted/60">
            {DOCUMENT_TABS.map((tab) => {
              const hasDoc = docMap.has(tab.id);
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="text-xs h-7 px-3 data-[state=active]:bg-background"
                >
                  <span className="flex items-center gap-1.5">
                    {hasDoc ? (
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                    {tab.label}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {currentDoc?.content ? (
            <article className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-3">
              <Streamdown plugins={{ code }}>{currentDoc.content}</Streamdown>
            </article>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3">
              <Clock className="size-8 animate-pulse text-muted-foreground/60" />
              <div>
                <p className="font-semibold text-sm text-foreground">Document Pending Generation</p>
                <p className="text-xs mt-1 max-w-sm">
                  {selectedDoc} is being drafted by the specialist Drafter station based on the active policy catalogue.
                </p>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
