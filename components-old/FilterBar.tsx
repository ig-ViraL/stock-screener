"use client";

import { useState, useEffect, useRef } from "react";
import {
  CAP_TIERS,
  type CapTier,
  type FilterParams,
} from "@/lib/filters";

const CAP_LABELS: Record<CapTier, string> = {
  mega: "Mega",
  large: "Large",
  mid: "Mid",
  small: "Small",
};

const CAP_DESCRIPTIONS: Record<CapTier, string> = {
  mega: ">$200B",
  large: "$10–200B",
  mid: "$2–10B",
  small: "<$2B",
};

interface FilterBarProps {
  filters: FilterParams;
  activeFilterCount: number;
  sectors: string[];
  onNumericFilter: (key: "pctMin" | "pctMax", value: number | undefined) => void;
  onToggleCapTier: (tier: CapTier) => void;
  onToggleSector: (sector: string) => void;
  onClear: () => void;
}

function DebouncedNumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder: string;
}) {
  const [local, setLocal] = useState(value?.toString() ?? "");

  useEffect(() => {
    setLocal(value?.toString() ?? "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocal(raw);
    if (raw === "") {
      onChange(undefined);
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num)) onChange(num);
    }
  };

  return (
    <input
      type="number"
      step="0.5"
      value={local}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-20 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm tabular-nums text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:bg-zinc-800 dark:focus:ring-blue-400"
    />
  );
}

function SectorDropdown({
  sectors,
  selected,
  onToggle,
}: {
  sectors: string[];
  selected: string[];
  onToggle: (sector: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label =
    selected.length === 0
      ? "All sectors"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} sectors`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
          selected.length > 0
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
            : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
      >
        <span className="truncate max-w-[160px]">{label}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {sectors.map((sector) => {
            const isSelected = selected.includes(sector);
            return (
              <button
                key={sector}
                type="button"
                onClick={() => onToggle(sector)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-500"
                      : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-700"
                  }`}
                >
                  {isSelected && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">{sector}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  activeFilterCount,
  sectors,
  onNumericFilter,
  onToggleCapTier,
  onToggleSector,
  onClear,
}: FilterBarProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-6 px-4 py-3">
        {/* % Change */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            % Change
          </span>
          <div className="flex items-center gap-1.5">
            <DebouncedNumberInput
              value={filters.pctMin}
              onChange={(v) => onNumericFilter("pctMin", v)}
              placeholder="Min"
            />
            <span className="text-zinc-300 dark:text-zinc-600">–</span>
            <DebouncedNumberInput
              value={filters.pctMax}
              onChange={(v) => onNumericFilter("pctMax", v)}
              placeholder="Max"
            />
          </div>
        </div>

        <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Market Cap */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Market Cap
          </span>
          <div className="flex gap-1">
            {CAP_TIERS.map((tier) => {
              const active = filters.cap.includes(tier);
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onToggleCapTier(tier)}
                  title={CAP_DESCRIPTIONS[tier]}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {CAP_LABELS[tier]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Sector */}
        {sectors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Sector
            </span>
            <SectorDropdown
              sectors={sectors}
              selected={filters.sector}
              onToggle={onToggleSector}
            />
          </div>
        )}
      </div>
    </div>
  );
}
