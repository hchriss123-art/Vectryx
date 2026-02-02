"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Props = {
  speedSeconds?: number; // lower = faster
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

export default function TickerTape({ speedSeconds = 20 }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const sb = supabase;
      if (!sb) return;

      const { data: sessionData } = await sb.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const { data } = await sb
        .from("user_preferences")
        .select("watchlist_text")
        .eq("user_id", user.id)
        .maybeSingle();

      const tickers = parseTickers((data as any)?.watchlist_text || "");
      setSymbols(tickers);
    };

    load();
  }, [supabase]);

  const tape = useMemo(() => {
    const base = symbols.length ? symbols : ["VECTRYX", "MARKET", "SIGNALS"];
    return [...base, ...base];
  }, [symbols]);

  const duration = Math.max(8, Number(speedSeconds || 20));

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
        {tape.map((t, idx) => (
          <div
            key={`${t}-${idx}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: 0.3,
            }}
          >
            <span style={{ opacity: 0.75, marginRight: 10 }}>•</span>
            {t}
          </div>
        ))}
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
