import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const store = getStore("search-jobs");
    const data = await store.get(jobId, { type: "json" });

    if (!data) {
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
