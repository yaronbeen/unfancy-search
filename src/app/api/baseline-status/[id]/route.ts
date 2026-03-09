import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await kvGet("baseline-jobs", id);

    if (!data) {
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
