import { NextResponse } from "next/server";
import { readCaseDocument, sanitizeStoragePath } from "@/agent/lib/documents/storage.ts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; filename: string[] }> }
) {
  const { caseId, filename } = await params;
  const rawPath = Array.isArray(filename) ? filename.join("/") : String(filename);
  const targetPath = sanitizeStoragePath(rawPath);

  try {
    const content = await readCaseDocument(caseId, targetPath);
    if (!content) {
      return NextResponse.json(
        { error: `Document "${targetPath}" not found for case "${caseId}"` },
        { status: 404 }
      );
    }

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error(`Error serving document ${targetPath} for case ${caseId}:`, error);
    return NextResponse.json(
      { error: "Internal server error reading document" },
      { status: 500 }
    );
  }
}
