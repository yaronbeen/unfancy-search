import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { hashQuery } from "@/lib/datasets";

function getBaselineStore() {
  const siteID =
    process.env.NETLIFY_SITE_ID ?? "f566d9dd-b740-4ecf-afcd-2e962bda6e7a";
  const token = process.env.NETLIFY_TOKEN;
  if (token) {
    return getStore({ name: "baselines", siteID, token });
  }
  return getStore("baselines");
}

/**
 * POST /api/baseline — Trigger a new baseline collection
 * Body: { query: string, geo?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const jobId = crypto.randomUUID();

    // Fire background function — don't await
    const bgUrl = new URL(
      "/.netlify/functions/baseline-background",
      request.url,
    );
    fetch(bgUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        geo: body.geo || "us",
        job_id: jobId,
      }),
    }).catch(() => {}); // fire-and-forget

    return NextResponse.json({ job_id: jobId, status: "pending" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start baseline collection",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/baseline?query=xyz — Get stored baseline for a query
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim();
    if (!query) {
      return NextResponse.json(
        { error: "query param is required" },
        { status: 400 },
      );
    }

    const queryHash = hashQuery(query);
    const store = getBaselineStore();
    const data = await store.get(queryHash, { type: "json" });

    if (!data) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ exists: true, baseline: data });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
