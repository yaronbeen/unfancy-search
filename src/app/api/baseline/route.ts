import { NextRequest, NextResponse } from "next/server";
import {
  triggerBaseline,
  checkBaselineProgress,
  fetchBaselineSnapshot,
  compareBaseline,
} from "@/lib/datasets";
import type { RankedResult } from "@/lib/types";

/**
 * POST /api/baseline — Trigger a new baseline collection or compare with live results.
 *
 * Body options:
 *   { action: "trigger", queries: string[], engine?: string, geo?: string }
 *   { action: "compare", snapshot_id: string, live_results: RankedResult[] }
 *   { action: "status", snapshot_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { error: "action is required (trigger | status | compare)" },
        { status: 400 },
      );
    }

    // --- Trigger a new baseline collection ---
    if (action === "trigger") {
      const queries = body.queries as string[] | undefined;
      if (!queries || queries.length === 0) {
        return NextResponse.json(
          { error: "queries array is required for trigger action" },
          { status: 400 },
        );
      }

      const engine = body.engine || "google";
      const geo = body.geo || "us";

      const { snapshot_id } = await triggerBaseline(queries, engine, geo);

      return NextResponse.json({
        snapshot_id,
        status: "collecting",
        message:
          "Baseline collection started. Poll with action: 'status' to check progress. Baseline can be refreshed daily or weekly.",
      });
    }

    // --- Check collection progress ---
    if (action === "status") {
      const snapshotId = body.snapshot_id as string | undefined;
      if (!snapshotId) {
        return NextResponse.json(
          { error: "snapshot_id is required for status action" },
          { status: 400 },
        );
      }

      const progress = await checkBaselineProgress(snapshotId);
      return NextResponse.json(progress);
    }

    // --- Compare baseline against live results ---
    if (action === "compare") {
      const snapshotId = body.snapshot_id as string | undefined;
      const liveResults = body.live_results as RankedResult[] | undefined;

      if (!snapshotId) {
        return NextResponse.json(
          { error: "snapshot_id is required for compare action" },
          { status: 400 },
        );
      }
      if (!liveResults || liveResults.length === 0) {
        return NextResponse.json(
          { error: "live_results array is required for compare action" },
          { status: 400 },
        );
      }

      const baseline = await fetchBaselineSnapshot(snapshotId);
      const diff = compareBaseline(liveResults, baseline);

      return NextResponse.json(diff);
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error("Baseline error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Baseline operation failed",
      },
      { status: 500 },
    );
  }
}
