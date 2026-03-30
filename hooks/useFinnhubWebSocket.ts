"use client";

import { useEffect, useRef, useState } from "react";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const FLUSH_MS = 500;          // flush buffered ticks to state every 500ms
const BASE_DELAY_MS = 2_000;   // initial reconnect delay
const MAX_DELAY_MS = 30_000;   // cap reconnect backoff at 30s

/**
 * Connects to the Finnhub WebSocket feed and returns a live price map.
 *
 * Price ticks are buffered in a ref and flushed to state every 500ms —
 * this means one re-render per 500ms regardless of how many ticks arrive,
 * preventing UI jank under rapid market data flow.
 *
 * Reconnects automatically on drop with exponential backoff (2s → 4s → 8s … 30s).
 * Cleans up (unsubscribes + closes) on unmount.
 *
 * Requires NEXT_PUBLIC_FINNHUB_API_KEY in the environment.
 */
export function useFinnhubWebSocket(symbols: readonly string[]) {
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // Buffer for incoming ticks — written on every message, read on interval
  const pendingRef = useRef(new Map<string, number>());

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error("[WebSocket] NEXT_PUBLIC_FINNHUB_API_KEY is not set");
      setStatus("disconnected");
      return;
    }

    let mounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect() {
      if (!mounted) return;
      setStatus((prev) => (prev === "connected" ? "reconnecting" : "connecting"));

      ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

      ws.onopen = () => {
        if (!mounted) { ws!.close(); return; }
        attempt = 0;
        setStatus("connected");
        // Subscribe to every symbol
        for (const sym of symbols) {
          ws!.send(JSON.stringify({ type: "subscribe", symbol: sym }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          // msg.type === "trade" carries an array of { s: symbol, p: price, t: ts, v: vol }
          if (msg.type === "trade" && Array.isArray(msg.data)) {
            for (const trade of msg.data) {
              // Later trades overwrite earlier ones — we only care about latest price
              pendingRef.current.set(trade.s as string, trade.p as number);
            }
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        setStatus("reconnecting");
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close(); // triggers onclose → schedules reconnect
      };
    }

    connect();

    // Flush buffered ticks → single setState per 500ms
    const flushId = setInterval(() => {
      if (!mounted || pendingRef.current.size === 0) return;
      const snapshot = new Map(pendingRef.current);
      pendingRef.current.clear();
      setPriceMap((prev) => new Map([...prev, ...snapshot]));
    }, FLUSH_MS);

    return () => {
      mounted = false;
      clearInterval(flushId);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      // Unsubscribe before closing — keeps Finnhub subscription count clean
      if (ws?.readyState === WebSocket.OPEN) {
        for (const sym of symbols) {
          ws.send(JSON.stringify({ type: "unsubscribe", symbol: sym }));
        }
      }
      ws?.close();
    };
  }, []); // symbols is STOCK_SYMBOLS constant — safe to capture once at mount

  return { priceMap, status };
}
