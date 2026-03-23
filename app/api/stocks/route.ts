import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAllStocks } from "@/lib/finnhub";
import { STOCK_SYMBOLS } from "@/lib/symbols";

const querySchema = z.object({
  symbols: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter((s) => (STOCK_SYMBOLS as readonly string[]).includes(s))
        : [...STOCK_SYMBOLS]
    )
    .refine((arr) => arr.length > 0, {
      message: "At least one valid symbol is required",
    }),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    symbols: searchParams.get("symbols") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const stocks = await fetchAllStocks(parsed.data.symbols);

  return NextResponse.json({ stocks, timestamp: Date.now() });
}
