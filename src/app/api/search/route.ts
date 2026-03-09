import { NextRequest, NextResponse } from "next/server";
import type { SearchRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SearchRequest>;
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const jobId = crypto.randomUUID();

    // Fire background function — don't await
    const bgUrl = new URL("/.netlify/functions/search-bg", request.url);
    fetch(bgUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, job_id: jobId }),
    }).catch(() => {}); // intentionally fire-and-forget

    return NextResponse.json({ job_id: jobId, status: "pending" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start search",
      },
      { status: 500 },
    );
  }
}
