"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ConnectionStatus, WebSocketTrade } from "@/lib/types";

const WS_URL = "wss://ws.finnhub.io";
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const THROTTLE_MS = 250;

interface UseFinnhubWebSocketOptions {
  symbols: string[];
  onPriceUpdate: (updates: Map<string, number>) => void;
  enabled?: boolean;
}

export function useFinnhubWebSocket({
  symbols,
  onPriceUpdate,
  enabled = true,
}: UseFinnhubWebSocketOptions) {
  const simulateWs =
    process.env.NEXT_PUBLIC_FINNHUB_WS_SIMULATE === "true" ||
    process.env.NEXT_PUBLIC_FINNHUB_WS_SIMULATE === "1";

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const pendingUpdates = useRef<Map<string, number>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const isMountedRef = useRef(false);
  const shouldReconnectRef = useRef(true);


  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  const onPriceUpdateRef = useRef(onPriceUpdate);
  onPriceUpdateRef.current = onPriceUpdate;

  const flushUpdates = useCallback(() => {
    if (pendingUpdates.current.size > 0) {
      const batch = new Map(pendingUpdates.current);
      pendingUpdates.current.clear();
      onPriceUpdateRef.current(batch);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !isMountedRef.current || !shouldReconnectRef.current) return;
    if (wsRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn(
        "[useFinnhubWebSocket] NEXT_PUBLIC_FINNHUB_API_KEY is not set. " +
          "Restart the dev server after adding it to .env."
      );
      setStatus("disconnected");
      return;
    }
    setStatus("connecting");

    const ws = new WebSocket(`${WS_URL}?token=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setStatus("connected");
      reconnectAttempts.current = 0;

      for (const symbol of symbolsRef.current) {
        ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "trade" && Array.isArray(data.data)) {
          for (const trade of data.data as WebSocketTrade[]) {
            pendingUpdates.current.set(trade.s, trade.p);
          }

          if (!flushTimer.current) {
            flushTimer.current = setTimeout(() => {
              flushTimer.current = undefined;
              flushUpdates();
            }, THROTTLE_MS);
          }
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = undefined;
      }
      flushUpdates();

      const canReconnect =
        wsRef.current === null &&
        enabled &&
        isMountedRef.current &&
        shouldReconnectRef.current &&
        reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS;

      if (canReconnect) {
        setStatus("reconnecting");
        const delay = Math.min(
          RECONNECT_BASE_DELAY * 2 ** reconnectAttempts.current,
          RECONNECT_MAX_DELAY
        );
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      } else {
        setStatus("disconnected");
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [enabled, flushUpdates]);

  useEffect(() => {
    if (!enabled || !simulateWs) return;

    // Simulation mode: mimic a live feed so the dashboard updates visually.
    setStatus("connected");

    const lastPrices = new Map<string, number>();
    const symbolsSnapshot = symbolsRef.current;

    const hashToBase = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      const positive = Math.abs(h);
      // Stable base per symbol, so it "looks" consistent across reloads.
      return 20 + (positive % 480);
    };

    for (const symbol of symbolsSnapshot) {
      lastPrices.set(symbol, hashToBase(symbol));
    }

    const simTickMs = 800;
    const interval = setInterval(() => {
      const batch = new Map<string, number>();
      for (const symbol of symbolsRef.current) {
        const prev = lastPrices.get(symbol) ?? hashToBase(symbol);
        // Random walk: small % step each tick.
        const step = (Math.random() - 0.5) * 0.01; // +/- ~0.5%
        const next = Math.max(0.01, prev * (1 + step));
        lastPrices.set(symbol, next);
        batch.set(symbol, Number(next.toFixed(2)));
      }
      onPriceUpdateRef.current(batch);
    }, simTickMs);

    return () => clearInterval(interval);
  }, [enabled, simulateWs]);

  const ensureConnected = useCallback(() => {
    if (simulateWs) return;
    if (
      enabled &&
      isMountedRef.current &&
      shouldReconnectRef.current &&
      !wsRef.current &&
      !reconnectTimer.current
    ) {
      reconnectAttempts.current = 0;
      connect();
    }
  }, [enabled, connect]);

  useEffect(() => {
    isMountedRef.current = true;
    shouldReconnectRef.current = true;

    if (enabled) {
      if (!simulateWs) connect();
      else setStatus("connected");
    } else {
      setStatus("disconnected");
    }

    return () => {
      shouldReconnectRef.current = false;
      isMountedRef.current = false;

      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (wsRef.current) {
        const current = wsRef.current;
        wsRef.current = null;
        current.close();
      }
    };
  }, [connect, enabled]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) ensureConnected();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") ensureConnected();
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ensureConnected]);

  return { status };
}
