"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type WatchlistQuote = {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function fmtPrice(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  try {
    return `$${Number(n).toFixed(2)}`;
  } catch {
    return "—";
  }
}

export default function TickerTape() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<WatchlistQuote[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let timer: number | null = null;

    const load = async () => {
      try {
        const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
        if (sessionErr) return;

        const user = sessionData.session?.user;
        if (!user) return;

        // Pull latest quotes
        const { data, error } = await sb
          .from("watchlist_quote")
          .select("ticker, price, change_pct, updated_at, created_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) return;

        // Deduplicate to latest per ticker
        const seen = new Set<string>();
        const out: WatchlistQuote[] = [];
        for (const q of (data as WatchlistQuote[]) ?? []) {
          const tk = String(q.ticker || "").toUpperCase();
          if (!tk) continue;
          if (seen.has(tk)) continue;
          seen.add(tk);
          out.push({ ...q, ticker: tk });
        }

        setItems(out);
        setReady(true);
      } catch {
        // ignore
      }
    };

    load();
    timer = window.setInterval(load, 15_000);

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [supabase]);

  // If nothing yet, don't render (prevents ugly blank bar)
  if (!ready || items.length === 0) return null;

  // Build the scrolling string: repeat list twice for seamless loop
  const row = items.slice(0, 25); // keep it light
  const loop = [...row, ...row];

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 44,
        background: "rgba(2,6,23,0.92)",
        borderTop: "1px solid rgba(148,163,184,0.25)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          whiteSpace: "nowrap",
          willChange: "transform",
          animation: "vectryxTickerScroll 35s linear infinite",
          paddingLeft: 16,
        }}
      >
        {loop.map((q, idx) => (
          <span
            key={`${q.ticker}-${idx}`}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 10,
              paddingRight: 22,
              color: "rgba(255,255,255,0.92)",
              fontSize: 13,
              fontWeight: 850,
            }}
          >
            <span style={{ fontWeight: 950 }}>{q.ticker}</span>
            <span style={{ opacity: 0.9 }}>{fmtPrice(q.price)}</span>
            {q.change_pct !== null && q.change_pct !== undefined ? (
              <span style={{ color: q.change_pct >= 0 ? "#22c55e" : "#ef4444" }}>
                {q.change_pct >= 0 ? "+" : ""}
                {Number(q.change_pct).toFixed(2)}%
              </span>
            ) : null}
            <span style={{ opacity: 0.35 }}>•</span>
          </span>
        ))}
      </div>

      <style jsx global>{`
        @keyframes vectryxTickerScroll {
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
