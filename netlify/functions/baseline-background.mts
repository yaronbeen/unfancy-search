import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import {
  triggerBaseline,
  fetchSnapshot,
  hashQuery,
} from "../../src/lib/datasets.js";
import { canonicalizeUrl, extractDomain } from "../../src/lib/dedupe.js";
import type { BaselineData, BaselineResult } from "../../src/lib/datasets.js";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_POLL_TIME_MS = 300_000; // 5 minutes

function getBlobStore(name: string) {
  const siteID =
    process.env.NETLIFY_SITE_ID ?? "f566d9dd-b740-4ecf-afcd-2e962bda6e7a";
  const token = process.env.NETLIFY_TOKEN;
  if (token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async (req: Request, _context: Context) => {
  let jobId: string | undefined;

  try {
    const body = await req.json();
    jobId = body.job_id;
    const { query, geo } = body;

    const jobStore = getBlobStore("baseline-jobs");

    // Update status: triggering
    await jobStore.setJSON(jobId!, {
      status: "collecting",
      message: "Triggering Datasets API collection...",
    });

    // Step 1: Trigger the Datasets collection
    const snapshotId = await triggerBaseline(query, geo || "us");

    await jobStore.setJSON(jobId!, {
      status: "collecting",
      message: "Waiting for Datasets API to finish collecting...",
      snapshot_id: snapshotId,
    });

    // Step 2: Poll for results
    const deadline = Date.now() + MAX_POLL_TIME_MS;
    let results: BaselineResult[] | null = null;

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
      geo: geo || "us",
      snapshot_id: snapshotId,
      collected_at: new Date().toISOString(),
      results: results.filter((r) => r.url), // drop empty URLs
    };

    const baselineStore = getBlobStore("baselines");
    const queryHash = hashQuery(query);
    await baselineStore.setJSON(queryHash, baselineData);

    // Step 4: Mark job complete
    await jobStore.setJSON(jobId!, {
      status: "done",
      baseline: baselineData,
    });
  } catch (err) {
    if (jobId) {
      try {
        const jobStore = getBlobStore("baseline-jobs");
        await jobStore.setJSON(jobId, {
          status: "error",
          error:
            err instanceof Error ? err.message : "Baseline collection failed",
        });
      } catch {
        // ignore blob write failure in error handler
      }
    }
  }
};
