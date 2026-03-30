"use client";

import { useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  parseFiltersFromParams,
  serializeFilters,
  countActiveFilters,
  EMPTY_FILTERS,
  type FilterParams,
  type CapTier,
} from "@/lib/filters";

const DEBOUNCE_MS = 300;

export function useStockFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const filters = parseFiltersFromParams(searchParams);
  const activeFilterCount = countActiveFilters(filters);

  const pushFilters = useCallback(
    (next: FilterParams) => {
      const params = serializeFilters(next);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname]
  );

  const setNumericFilter = useCallback(
    (key: "pctMin" | "pctMax", value: number | undefined) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const current = parseFiltersFromParams(
          new URLSearchParams(window.location.search)
        );
        pushFilters({ ...current, [key]: value });
      }, DEBOUNCE_MS);
    },
    [pushFilters]
  );

  const toggleCapTier = useCallback(
    (tier: CapTier) => {
      const current = parseFiltersFromParams(
        new URLSearchParams(window.location.search)
      );
      const cap = current.cap.includes(tier)
        ? current.cap.filter((t) => t !== tier)
        : [...current.cap, tier];
      pushFilters({ ...current, cap });
    },
    [pushFilters]
  );

  const toggleSector = useCallback(
    (sector: string) => {
      const current = parseFiltersFromParams(
        new URLSearchParams(window.location.search)
      );
      const sectors = current.sector.includes(sector)
        ? current.sector.filter((s) => s !== sector)
        : [...current.sector, sector];
      pushFilters({ ...current, sector: sectors });
    },
    [pushFilters]
  );

  const clearFilters = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    pushFilters(EMPTY_FILTERS);
  }, [pushFilters]);

  return {
    filters,
    activeFilterCount,
    setNumericFilter,
    toggleCapTier,
    toggleSector,
    clearFilters,
  };
}
