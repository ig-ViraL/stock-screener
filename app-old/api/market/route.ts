import { NextResponse } from "next/server";
import { fetchMarketStatus, fetchMarketHolidays } from "@/lib/finnhub";

export async function GET() {
  try {
    const [status, holidays] = await Promise.all([
      fetchMarketStatus("US"),
      fetchMarketHolidays("US"),
    ]);

    return NextResponse.json({ status, holidays });
  } catch (error) {
    console.error("Market info fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch market information" },
      { status: 502 }
    );
  }
}
