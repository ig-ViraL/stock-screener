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
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn(
        "[useFinnhubWebSocket] NEXT_PUBLIC_FINNHUB_API_KEY is not set. " +
          "Restart the dev server after adding it to .env."
      );
      setStatus("disconnected");
      return;
    }
    if (!enabled) return;

    setStatus("connecting");

    const ws = new WebSocket(`${WS_URL}?token=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttempts.current = 0;

      for (const symbol of symbolsRef.current) {
        ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    };

    ws.onmessage = (event) => {
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
      wsRef.current = null;
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = undefined;
      }
      flushUpdates();

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS && enabled) {
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
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  return { status };
}
