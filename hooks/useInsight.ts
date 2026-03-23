"use client";

import { useState, useCallback, useRef } from "react";

export interface InsightStockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percentChange: number;
  marketCap: number;
  industry: string;
  metrics?: {
    peRatio?: number;
    eps?: number;
    beta?: number;
    dividendYield?: number;
    roe?: number;
    debtToEquity?: number;
  };
}

interface UseInsightReturn {
  insight: string;
  isStreaming: boolean;
  error: string | null;
  generateInsight: (data: InsightStockData) => void;
  reset: () => void;
}

const clientCache = new Map<string, string>();

export function useInsight(): UseInsightReturn {
  const [insight, setInsight] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setInsight("");
    setIsStreaming(false);
    setError(null);
  }, []);

  const generateInsight = useCallback((data: InsightStockData) => {
    const symbol = data.symbol.toUpperCase();

    const cached = clientCache.get(symbol);
    if (cached) {
      setInsight(cached);
      setIsStreaming(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setInsight("");
    setIsStreaming(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = "Failed to generate insight";
          try {
            const json = await res.json();
            if (json.error) message = json.error;
          } catch {
            // response wasn't JSON
          }
          setError(message);
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("Streaming not supported");
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          accumulated += text;
          setInsight(accumulated);
        }

        if (accumulated) {
          clientCache.set(symbol, accumulated);
        }
        setIsStreaming(false);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to generate insight. Please try again.");
        setIsStreaming(false);
      }
    })();
  }, []);

  return { insight, isStreaming, error, generateInsight, reset };
}
