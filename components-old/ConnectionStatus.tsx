"use client";

import type { ConnectionStatus as Status } from "@/lib/types";

const statusConfig: Record<
  Status,
  { label: string; dotClass: string; textClass: string }
> = {
  connected: {
    label: "Live",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  connecting: {
    label: "Connecting\u2026",
    dotClass: "bg-amber-500 animate-pulse",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  reconnecting: {
    label: "Reconnecting\u2026",
    dotClass: "bg-amber-500 animate-pulse",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
  },
};

export function ConnectionStatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.textClass} border-current/20`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
