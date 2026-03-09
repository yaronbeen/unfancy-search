import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const data = await kvGet("search-jobs", jobId);

    if (!data) {
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
