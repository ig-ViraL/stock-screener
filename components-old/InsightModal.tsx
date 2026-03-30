"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useInsight, type InsightStockData } from "@/hooks/useInsight";
import { formatPrice, formatPercent } from "@/lib/format";

interface InsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: InsightStockData;
}

function ModalContent({ stock, onClose }: Omit<InsightModalProps, "isOpen">) {
  const { insight, isStreaming, error, generateInsight, reset } = useInsight();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generateInsight(stock);
    return () => reset();
  }, [stock.symbol, generateInsight, reset]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const isPositive = stock.change >= 0;
  const changeColor = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";

  return createPortal(
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="insight-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/60">
              <svg
                className="h-4 w-4 text-violet-600 dark:text-violet-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
            </div>
            <div>
              <h2
                id="insight-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
              >
                AI Analysis
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {stock.symbol}
                </span>
                <span>&middot;</span>
                <span>{stock.name}</span>
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Stock summary bar */}
        <div className="flex items-center gap-4 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatPrice(stock.price)}
          </span>
          <span className={`text-xs font-medium tabular-nums ${changeColor}`}>
            {formatPercent(stock.percentChange)}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {stock.industry}
          </span>
        </div>

        {/* Body */}
        <div className="min-h-[120px] px-5 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                <svg
                  className="h-5 w-5 text-red-500 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => generateInsight(stock)}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                Retry
              </button>
            </div>
          ) : !insight && isStreaming ? (
            <div className="space-y-2.5">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {insight}
              {isStreaming ? (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500" />
              ) : null}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            AI-generated &mdash; may not reflect current market conditions
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function InsightModal({ isOpen, onClose, stock }: InsightModalProps) {
  if (!isOpen) return null;
  return <ModalContent stock={stock} onClose={onClose} />;
}
