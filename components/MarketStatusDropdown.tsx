"use client";

import { useState, useRef, useEffect } from "react";
import type { MarketInfo, MarketStatus, MarketHoliday } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_CONFIG: Record<
  string,
  { label: string; color: string; dotClass: string; pulse: boolean }
> = {
  regular: {
    label: "Market Open",
    color: "text-emerald-400",
    dotClass: "bg-emerald-500",
    pulse: true,
  },
  "pre-market": {
    label: "Pre-Market",
    color: "text-amber-400",
    dotClass: "bg-amber-500",
    pulse: false,
  },
  "post-market": {
    label: "After Hours",
    color: "text-amber-400",
    dotClass: "bg-amber-500",
    pulse: false,
  },
  closed: {
    label: "Market Closed",
    color: "text-zinc-400",
    dotClass: "bg-zinc-500",
    pulse: false,
  },
};

function getConfig(status: MarketStatus) {
  if (status.isOpen && status.session) {
    return SESSION_CONFIG[status.session] ?? SESSION_CONFIG.regular;
  }
  return SESSION_CONFIG.closed;
}

function upcomingHolidays(holidays: MarketHoliday[]): MarketHoliday[] {
  const today = new Date().toISOString().slice(0, 10);
  return holidays
    .filter((h) => h.atDate >= today)
    .sort((a, b) => a.atDate.localeCompare(b.atDate))
    .slice(0, 5);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: MarketInfo;
}

export function MarketStatusDropdown({ data }: Props) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cfg = getConfig(data.status);
  const upcoming = upcomingHolidays(data.holidays);
  const nextHoliday = upcoming[0];

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (
        popoverRef.current?.contains(e.target as Node) === false &&
        triggerRef.current?.contains(e.target as Node) === false
      ) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="relative">
      {/* Trigger pill */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium transition-colors hover:border-zinc-600 hover:bg-zinc-800 ${cfg.color}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${cfg.dotClass} ${cfg.pulse ? "animate-pulse" : ""}`}
        />
        {cfg.label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown popover */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Market status details"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
        >
          {/* Header row */}
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                Market Status
              </h3>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
                {cfg.label}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500">
              <div>
                Exchange:{" "}
                <span className="font-medium text-zinc-300">
                  {data.status.exchange}
                </span>
              </div>
              <div>
                Timezone:{" "}
                <span className="font-medium text-zinc-300">
                  {data.status.timezone?.split("/").pop()?.replace("_", " ") ?? "N/A"}
                </span>
              </div>
              {data.status.session && (
                <div>
                  Session:{" "}
                  <span className="font-medium text-zinc-300">
                    {data.status.session}
                  </span>
                </div>
              )}
              {data.status.holiday && (
                <div className="col-span-2">
                  Holiday:{" "}
                  <span className="font-medium text-amber-400">
                    {data.status.holiday}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming holidays */}
          {upcoming.length > 0 && (
            <div className="px-4 py-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
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
                        <p className="text-sm font-medium text-zinc-200">
                          {h.eventName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(h.atDate)}
                          {h.tradingHour && (
                            <span className="ml-1.5 rounded bg-amber-900/40 px-1 py-0.5 text-[10px] font-medium text-amber-400">
                              Early close {h.tradingHour}
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isToday
                            ? "bg-red-900/40 text-red-400"
                            : isSoon
                              ? "bg-amber-900/40 text-amber-400"
                              : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {isToday ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Footer: next closure */}
          {nextHoliday && (
            <div className="border-t border-zinc-800 px-4 py-2">
              <p className="text-[11px] text-zinc-500">
                Next closure:{" "}
                <span className="font-medium text-zinc-400">
                  {nextHoliday.eventName}
                </span>{" "}
                ({formatDate(nextHoliday.atDate)})
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
