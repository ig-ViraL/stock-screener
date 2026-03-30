import { z } from "zod";
import type { Stock } from "./types";

export const CAP_TIERS = ["mega", "large", "mid", "small"] as const;
export type CapTier = (typeof CAP_TIERS)[number];

const CAP_THRESHOLDS: Record<CapTier, { min: number; max: number }> = {
  mega: { min: 200_000, max: Infinity },
  large: { min: 10_000, max: 200_000 },
  mid: { min: 2_000, max: 10_000 },
  small: { min: 0, max: 2_000 },
};

export interface FilterParams {
  pctMin?: number;
  pctMax?: number;
  cap: CapTier[];
  sector: string[];
}

export const EMPTY_FILTERS: FilterParams = {
  pctMin: undefined,
  pctMax: undefined,
  cap: [],
  sector: [],
};

const commaSplit = z
  .string()
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean));

const filterSchema = z.object({
  pctMin: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().finite().optional()),
  pctMax: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().finite().optional()),
  cap: commaSplit
    .optional()
    .transform((arr) =>
      arr ? arr.filter((v): v is CapTier => CAP_TIERS.includes(v as CapTier)) : []
    ),
  sector: commaSplit.optional().transform((arr) => arr ?? []),
});

export function parseFiltersFromParams(
  searchParams: URLSearchParams
): FilterParams {
  const raw = {
    pctMin: searchParams.get("pctMin") ?? undefined,
    pctMax: searchParams.get("pctMax") ?? undefined,
    cap: searchParams.get("cap") ?? undefined,
    sector: searchParams.get("sector") ?? undefined,
  };

  const result = filterSchema.safeParse(raw);
  if (!result.success) return EMPTY_FILTERS;
  return result.data;
}

export function serializeFilters(filters: FilterParams): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.pctMin !== undefined) params.set("pctMin", String(filters.pctMin));
  if (filters.pctMax !== undefined) params.set("pctMax", String(filters.pctMax));
  if (filters.cap.length > 0) params.set("cap", filters.cap.join(","));
  if (filters.sector.length > 0) params.set("sector", filters.sector.join(","));

  return params;
}

export function getCapTier(marketCapInMillions: number): CapTier {
  if (marketCapInMillions >= CAP_THRESHOLDS.mega.min) return "mega";
  if (marketCapInMillions >= CAP_THRESHOLDS.large.min) return "large";
  if (marketCapInMillions >= CAP_THRESHOLDS.mid.min) return "mid";
  return "small";
}

export function applyFilters(stocks: Stock[], filters: FilterParams): Stock[] {
  return stocks.filter((stock) => {
    if (filters.pctMin !== undefined && stock.percentChange < filters.pctMin) {
      return false;
    }
    if (filters.pctMax !== undefined && stock.percentChange > filters.pctMax) {
      return false;
    }

    if (filters.cap.length > 0) {
      const tier = getCapTier(stock.marketCap);
      if (!filters.cap.includes(tier)) return false;
    }

    if (filters.sector.length > 0) {
      if (!filters.sector.includes(stock.industry)) return false;
    }

    return true;
  });
}

export function countActiveFilters(filters: FilterParams): number {
  let count = 0;
  if (filters.pctMin !== undefined) count++;
  if (filters.pctMax !== undefined) count++;
  if (filters.cap.length > 0) count++;
  if (filters.sector.length > 0) count++;
  return count;
}
