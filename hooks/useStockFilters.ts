"use client";

import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseFiltersFromParams,
  serializeFilters,
  countActiveFilters,
  EMPTY_FILTERS,
  type FilterParams,
  type CapTier,
} from "@/lib/filters";

const DEBOUNCE_MS = 300;

function syncUrl(next: FilterParams) {
  const params = serializeFilters(next);
  const qs = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${qs ? `?${qs}` : ""}`
  );
}

export function useStockFilters() {
  const searchParams = useSearchParams();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Initialized from URL params — changes are local state only.
  // URL bar is kept in sync via window.history.replaceState (no navigation,
  // no server re-render, no cache busting).
  const [filters, setFilters] = useState<FilterParams>(() =>
    parseFiltersFromParams(searchParams)
  );

  const activeFilterCount = countActiveFilters(filters);

  const pushFilters = useCallback((next: FilterParams) => {
    setFilters(next);
    syncUrl(next);
  }, []);

  const setNumericFilter = useCallback(
    (key: "pctMin" | "pctMax", value: number | undefined) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setFilters((current) => {
          const next = { ...current, [key]: value };
          syncUrl(next);
          return next;
        });
      }, DEBOUNCE_MS);
    },
    []
  );

  const toggleCapTier = useCallback((tier: CapTier) => {
    setFilters((current) => {
      const cap = current.cap.includes(tier)
        ? current.cap.filter((t) => t !== tier)
        : [...current.cap, tier];
      const next = { ...current, cap };
      syncUrl(next);
      return next;
    });
  }, []);

  const toggleSector = useCallback((sector: string) => {
    setFilters((current) => {
      const sectorList = current.sector.includes(sector)
        ? current.sector.filter((s) => s !== sector)
        : [...current.sector, sector];
      const next = { ...current, sector: sectorList };
      syncUrl(next);
      return next;
    });
  }, []);

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
