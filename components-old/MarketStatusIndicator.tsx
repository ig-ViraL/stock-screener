"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MarketStatus, MarketHoliday, MarketInfo } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;

const SESSION_CONFIG: Record<
  string,
  { label: string; color: string; dotClass: string }
> = {
  regular: {
    label: "Market Open",
    color: "text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "pre-market": {
    label: "Pre-Market",
    color: "text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  "post-market": {
    label: "After Hours",
    color: "text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  closed: {
    label: "Market Closed",
    color: "text-zinc-500 dark:text-zinc-400",
    dotClass: "bg-zinc-400 dark:bg-zinc-500",
  },
};

function getSessionConfig(status: MarketStatus) {
  if (status.isOpen && status.session) {
    return SESSION_CONFIG[status.session] ?? SESSION_CONFIG.regular;
  }
  return SESSION_CONFIG.closed;
}

function getUpcomingHolidays(holidays: MarketHoliday[]): MarketHoliday[] {
  const today = new Date().toISOString().slice(0, 10);
  return holidays
    .filter((h) => h.atDate >= today)
    .sort((a, b) => a.atDate.localeCompare(b.atDate))
    .slice(0, 5);
}

function formatHolidayDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

interface Props {
  initialData: MarketInfo | null;
}

export function MarketStatusIndicator({ initialData }: Props) {
  const [data, setData] = useState<MarketInfo | null>(initialData);
  const [open, setOpen] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MarketInfo = await res.json();
      setData(json);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }

    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData, initialData]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!data && !fetchError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-600" />
        Loading&hellip;
      </span>
    );
  }

  if (fetchError && !data) {
    return null;
  }

  const status = data!.status;
  const holidays = data!.holidays;
  const cfg = getSessionConfig(status);
  const upcoming = getUpcomingHolidays(holidays);
  const nextHoliday = upcoming[0];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${cfg.color} border-current/20`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${cfg.dotClass} ${status.isOpen && status.session === "regular" ? "animate-pulse" : ""}`}
        />
        {cfg.label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Market status details"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Market Status
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`}
                />
                {cfg.label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <div>
                Exchange:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {status.exchange}
                </span>
              </div>
              <div>
                Timezone:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {status.timezone?.split("/").pop()?.replace("_", " ") ??
                    "N/A"}
                </span>
              </div>
              {status.session ? (
                <div>
                  Session:{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {status.session}
                  </span>
                </div>
              ) : null}
              {status.holiday ? (
                <div className="col-span-2">
                  Holiday:{" "}
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {status.holiday}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {upcoming.length > 0 ? (
            <div className="px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Upcoming Holidays
              </h4>
              <ul className="space-y-2">
                {upcoming.map((h) => {
                  const days = daysUntil(h.atDate);
                  const isToday = days === 0;
                  const isSoon = days <= 7;

                  return (
                    <li
                      key={h.atDate + h.eventName}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {h.eventName}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatHolidayDate(h.atDate)}
                          {h.tradingHour ? (
                            <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Early close {h.tradingHour}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isToday
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : isSoon
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {isToday
                          ? "Today"
                          : days === 1
                            ? "Tomorrow"
                            : `${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {nextHoliday ? (
            <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Next closure:{" "}
                <span className="font-medium">
                  {nextHoliday.eventName}
                </span>{" "}
                ({formatHolidayDate(nextHoliday.atDate)})
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
