import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { triggerBaseline, fetchSnapshot, hashQuery } from "@/lib/datasets";
import type { BaselineData } from "@/lib/datasets";
import { kvSet, kvGet } from "@/lib/kv-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_POLL_TIME_MS = 300_000; // 5 minutes

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBaselineCollection(
  query: string,
  geo: string,
  jobId: string,
) {
  try {
    await kvSet("baseline-jobs", jobId, {
      status: "collecting",
      message: "Triggering Datasets API collection...",
    });

    // Step 1: Trigger the Datasets collection
    const snapshotId = await triggerBaseline(query, geo);

    await kvSet("baseline-jobs", jobId, {
      status: "collecting",
      message: "Waiting for Datasets API to finish collecting...",
      snapshot_id: snapshotId,
    });

    // Step 2: Poll for results
    const deadline = Date.now() + MAX_POLL_TIME_MS;
    let results: Awaited<ReturnType<typeof fetchSnapshot>> = null;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      results = await fetchSnapshot(snapshotId);
      if (results !== null) break;
    }

    if (results === null) {
      throw new Error(
        "Baseline collection timed out after 5 minutes. Try again later.",
      );
    }

    // Step 3: Store the baseline
    const baselineData: BaselineData = {
      query,
      geo,
      snapshot_id: snapshotId,
      collected_at: new Date().toISOString(),
      results: results.filter((r) => r.url),
    };

    const queryHash = hashQuery(query);
    await kvSet("baselines", queryHash, baselineData);

    // Step 4: Mark job complete
    await kvSet("baseline-jobs", jobId, {
      status: "done",
      baseline: baselineData,
    });
  } catch (err) {
    try {
      await kvSet("baseline-jobs", jobId, {
        status: "error",
        error:
          err instanceof Error ? err.message : "Baseline collection failed",
      });
    } catch {
      // ignore KV write failure in error handler
    }
  }
}

/**
 * POST /api/baseline — Trigger a new baseline collection
 * Body: { query: string, geo?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      query?: string;
      geo?: string;
      turnstileToken?: string;
    };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    // Rate limiting: 3 baselines per hour per IP
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, "baseline", 3, 3600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Baseline collection rate limited. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter ?? 3600) },
        },
      );
    }

    // Turnstile verification
    const turnstileResult = await verifyTurnstile(body.turnstileToken, ip);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { error: turnstileResult.error },
        { status: 403 },
      );
    }

    const jobId = crypto.randomUUID();

    // Run baseline collection in background using Cloudflare's waitUntil
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(runBaselineCollection(query, body.geo || "us", jobId));

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
    const data = await kvGet("baselines", queryHash);

    if (!data) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ exists: true, baseline: data });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
