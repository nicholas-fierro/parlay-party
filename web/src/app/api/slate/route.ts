import { NextResponse, type NextRequest } from "next/server";
import { mockSlate } from "@/lib/odds/mock";
import { getSgoSlate } from "@/lib/odds/sgo";

// Mock kickoffs are anchored to server start so one game is always "started".
const MOCK_EPOCH = Date.now();

export async function GET(request: NextRequest) {
  const key = process.env.SGO_API_KEY;
  const force = request.nextUrl.searchParams.get("force") === "1";
  const wantMock = request.nextUrl.searchParams.get("source") === "mock";

  if (!key || wantMock) return NextResponse.json(mockSlate(MOCK_EPOCH));

  try {
    return NextResponse.json(await getSgoSlate(key, force));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Odds unavailable";
    return NextResponse.json({ ...mockSlate(MOCK_EPOCH), warning: `${message}. Using mock data.` });
  }
}
