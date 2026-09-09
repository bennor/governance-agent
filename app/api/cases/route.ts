import { NextResponse } from "next/server";
import { listCaseManifests } from "@/agent/lib/documents/storage.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cases = await listCaseManifests();
    return NextResponse.json(
      { cases },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Failed to list governance cases:", error);
    return NextResponse.json(
      { error: "Failed to list governance cases", cases: [] },
      { status: 500 }
    );
  }
}
