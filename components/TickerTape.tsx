"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Props = {
  speedSeconds?: number; // lower = faster
  pollMs?: number;       // how often to refresh quotes from Supabase
};

type QuoteRow = {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parseTickers(raw: string): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    const tk = t.replace(/^\$/, ""); // strip leading $ if user pasted $AAPL
    if (!tk) continue;
    if (seen.has(tk)) continue;
    seen.add(tk);
    out.push(tk);
  }
  return out;
}

function quoteTs(q?: QuoteRow | null): string | null {
  if (!q) return null;
  return (q.updated_at || q.created_at || null) as string | null;
}

function isStale(ts: string | null, minutes = 6): boolean {
  if (!ts) return true;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return true;
  const ageMs = Date.now() - d.getTime();
  return ageMs > minutes * 60 * 1000;
}

export default function TickerTape({ speedSeconds = 20, pollMs = 60_000 }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteRow>>({});
  const inFlight = useRef(false);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        const { data: sessionData, error: sErr } = await sb.auth.getSession();
        if (sErr) {
          console.error("ticker tape session error:", sErr.message);
          return;
        }

        const user = sessionData.session?.user;
        if (!user) return;

        // 1) Tickers from user_preferences (single source of truth)
        const { data: pref, error: prefErr } = await sb
          .from("user_preferences")
          .select("watchlist_text")
          .eq("user_id", user.id)
          .maybeSingle();

        if (prefErr) {
          console.error("ticker tape prefs error:", prefErr.message);
          return;
        }

        const tickers = parseTickers((pref as any)?.watchlist_text || "");
        setSymbols(tickers);

        if (!tickers.length) {
          setQuotes({});
          return;
        }

        // 2) Quotes from watchlist_quote, only for the tickers we display
        const { data: rows, error: qErr } = await sb
          .from("watchlist_quote")
          .select("ticker, price, change_pct, created_at, updated_at")
          .eq("user_id", user.id)
          .in("ticker", tickers)
          .order("updated_at", { ascending: false });

        if (qErr) {
          console.error("ticker tape quote error:", qErr.message);
          return;
        }

        const latest: Record<string, QuoteRow> = {};
        for (const r of (rows as QuoteRow[]) ?? []) {
          const key = String(r.ticker || "").toUpperCase();
          if (!key) continue;
          if (!latest[key]) latest[key] = { ...r, ticker: key };
        }
        setQuotes(latest);
      } finally {
        inFlight.current = false;
      }
    };

    // Initial load + interval (match worker cadence; avoid 15s hammering)
    load();
    const timer = window.setInterval(load, pollMs);
    return () => window.clearInterval(timer);
  }, [supabase, pollMs]);

  // Duplicate list so it loops seamlessly
  const tape = useMemo(() => {
    const base = symbols.length ? symbols : ["VECTRYX", "MARKET", "SIGNALS"];
    return [...base, ...base];
  }, [symbols]);

  const duration = Math.max(8, Number(speedSeconds || 20)); // safety
  const staleMinutes = Math.max(5, Math.round((pollMs / 1000 / 60) * 3)); // ~3x poll interval

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 52,
        background: "rgba(2,6,23,0.92)",
        borderTop: "1px solid rgba(148,163,184,0.25)",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          height: "100%",
          animation: `vectryx-ticker ${duration}s linear infinite`,
          willChange: "transform",
        }}
      >
        {tape.map((sym, idx) => {
          const q = quotes[sym];
          const ts = quoteTs(q);
          const stale = isStale(ts, staleMinutes);

          const rawPrice = q?.price;
          const rawPct = q?.change_pct;

          const price =
            typeof rawPrice === "number" && Number.isFinite(rawPrice) ? rawPrice : null;

          const pct =
            typeof rawPct === "number" && Number.isFinite(rawPct) ? rawPct : null;

          return (
            <div
              key={`${sym}-${idx}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 800,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: 0.3,
                gap: 10,
              }}
              title={ts ? `Last updated: ${new Date(ts).toLocaleString()}` : "No timestamp"}
            >
              <span style={{ opacity: 0.75 }}>•</span>

              <span>{sym}</span>

              {price !== null ? (
                <span style={{ opacity: 0.9 }}>${price.toFixed(2)}</span>
              ) : (
                <span style={{ opacity: 0.6 }}>—</span>
              )}

              {pct !== null ? (
                <span
                  style={{
                    fontWeight: 900,
                    color: pct >= 0 ? "#22c55e" : "#ef4444",
                    opacity: 0.95,
                  }}
                >
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
              ) : null}

              {/* small dot if data is stale */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: stale ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)",
                  opacity: 0.9,
                }}
              />
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes vectryx-ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
