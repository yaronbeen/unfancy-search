import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

function getJobStore() {
  const siteID =
    process.env.NETLIFY_SITE_ID ?? "f566d9dd-b740-4ecf-afcd-2e962bda6e7a";
  const token = process.env.NETLIFY_TOKEN;
  if (token) {
    return getStore({ name: "baseline-jobs", siteID, token });
  }
  return getStore("baseline-jobs");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const store = getJobStore();
    const data = await store.get(id, { type: "json" });

    if (!data) {
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
