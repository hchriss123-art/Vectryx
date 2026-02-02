"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Props = {
  speedSeconds?: number; // lower = faster
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
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function quoteTs(q?: QuoteRow | null): string | null {
  if (!q) return null;
  return (q.updated_at || q.created_at || null) as string | null;
}

function isStale(ts: string | null, minutes = 10): boolean {
  if (!ts) return true;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return true;
  const ageMs = Date.now() - d.getTime();
  return ageMs > minutes * 60 * 1000;
}

export default function TickerTape({ speedSeconds = 20 }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteRow>>({});

  // Load tickers + quotes
  useEffect(() => {
    const load = async () => {
      const sb = supabase;
      if (!sb) return;

      const { data: sessionData } = await sb.auth.getSession();
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

      // 2) Quotes from watchlist_quote
      const { data: rows, error: qErr } = await sb
        .from("watchlist_quote")
        .select("ticker, price, change_pct, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (qErr) {
        console.error("ticker tape quote error:", qErr.message);
        return;
      }

      // keep latest per ticker
      const latest: Record<string, QuoteRow> = {};
      for (const r of (rows as QuoteRow[]) ?? []) {
        const key = String(r.ticker || "").toUpperCase();
        if (!key) continue;
        if (!latest[key]) latest[key] = { ...r, ticker: key };
      }
      setQuotes(latest);
    };

    load();
    const timer = window.setInterval(load, 15_000); // stay in sync with dashboard polling
    return () => window.clearInterval(timer);
  }, [supabase]);

  // Build tape items (duplicate list so it loops seamlessly)
  const tape = useMemo(() => {
    const base = symbols.length ? symbols : ["VECTRYX", "MARKET", "SIGNALS"];
    return [...base, ...base];
  }, [symbols]);

  const duration = Math.max(8, Number(speedSeconds || 20)); // safety

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
        }}
      >
        {tape.map((sym, idx) => {
          const q = quotes[sym];
          const ts = quoteTs(q);
          const stale = isStale(ts, 10);

          const price =
            q?.price === null || q?.price === undefined ? null : Number(q.price);

          const pct =
            q?.change_pct === null || q?.change_pct === undefined
              ? null
              : Number(q.change_pct);

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
