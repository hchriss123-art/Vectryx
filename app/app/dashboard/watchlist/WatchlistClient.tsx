"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Plan = "FREE" | "PRO" | "MORPHEUS";

type WatchlistQuote = {
  ticker: string;
  price: number;
  change_pct: number | null;
  created_at: string;
};

type UserProfile = {
  user_id: string;
  full_name: string | null;
  plan?: Plan;
  extra_ticker_blocks?: number;
};

type UserPrefs = {
  user_id: string;
  watchlist_text: string;
  updated_at?: string | null;
};

const BASE_LIMIT_BY_PLAN: Record<Plan, number> = {
  FREE: 5,
  PRO: 15,
  MORPHEUS: 50,
};

function parseTickers(raw: string): string[] {
  // tolerant parsing: commas, spaces, newlines
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  // de-dupe while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export default function WatchlistClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});

  const plan: Plan = (profile?.plan as Plan) ?? "FREE";
  const extraBlocks = Number(profile?.extra_ticker_blocks ?? 0);
  const tickerLimit = (BASE_LIMIT_BY_PLAN[plan] ?? 5) + Math.max(0, extraBlocks) * 10;

  const tickers = useMemo(() => parseTickers(prefs?.watchlist_text ?? ""), [prefs?.watchlist_text]);
  const planLabel = plan === "MORPHEUS" ? "VECTRYX" : plan;

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setStatusMsg(null);

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        setStatusMsg(sessionErr.message);
        setLoading(false);
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("user_profile")
        .select("user_id, full_name, plan, extra_ticker_blocks")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profErr) {
        setStatusMsg(profErr.message);
        setLoading(false);
        return;
      }
      setProfile((prof as UserProfile | null) ?? null);

      const { data: prefRow, error: prefErr } = await supabase
        .from("user_preferences")
        .select("user_id, watchlist_text, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefErr) {
        setStatusMsg(prefErr.message);
        setLoading(false);
        return;
      }
      setPrefs((prefRow as UserPrefs | null) ?? null);

      setLoading(false);
    };

    boot();
  }, [supabase]);

  useEffect(() => {
  const loadQuotes = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("watchlist_quote")
      .select("ticker, price, change_pct, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Quote load error:", error.message);
      return;
    }

    // keep latest quote per ticker
    const latest: Record<string, WatchlistQuote> = {};
    for (const q of data ?? []) {
      if (!latest[q.ticker]) {
        latest[q.ticker] = q;
      }
    }

    setQuotes(latest);
  };

  loadQuotes();
  const id = window.setInterval(loadQuotes, 15_000); // every 15s (feels real-time)
  return () => window.clearInterval(id);
}, [supabase, tickers.join("|")]);



  return (
    <main style={{ minHeight: "100vh", background: "#0b1220" }}>
      <Navbar />

      <div style={{ background: "linear-gradient(135deg, #0f172a, #020617)", color: "white" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 18px 22px" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Plan: {planLabel}</div>
          <h1 style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 6px 0", fontWeight: 950 }}>
            Watchlist
          </h1>
          <div style={{ opacity: 0.86, fontSize: 14, lineHeight: 1.6, maxWidth: 820 }}>
            All tickers you’re tracking (dashboard surfaces only the highest-confidence signals).
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "18px" }}>
        {statusMsg && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "rgba(239,68,68,0.12)", color: "white" }}>
            {statusMsg}
          </div>
        )}

        <section
          style={{
            borderRadius: 16,
            padding: 18,
            background: "rgba(2, 6, 23, 0.35)",
            border: "1px solid rgba(148,163,184,0.25)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Your tickers</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                {tickers.length} / {tickerLimit} used
                {prefs?.updated_at ? ` • Updated ${new Date(prefs.updated_at).toLocaleString()}` : ""}
              </div>
            </div>

            <a
              href="/app/dashboard"
              style={{
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 900,
                border: "1px solid rgba(148,163,184,0.35)",
                borderRadius: 12,
                padding: "8px 12px",
              }}
            >
              Back to Dashboard →
            </a>
          </div>

          {loading ? (
            <div style={{ marginTop: 14, opacity: 0.75 }}>Loading watchlist…</div>
          ) : tickers.length === 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>No tickers yet</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                Add tickers in Preferences to start tracking.
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {tickers.map((t) => (
                <a
                  key={t}
                  href={`/app/dashboard/${t}`}
                  style={{
                    display: "block",
                    borderRadius: 14,
                    padding: 14,
                    background: "rgba(2, 6, 23, 0.25)",
                    border: "1px solid rgba(148,163,184,0.20)",
                    color: "rgba(255,255,255,0.92)",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 950 }}>{t}</div>

{quotes[t] ? (
  <div style={{ marginTop: 6, fontSize: 13 }}>
    <div>Price: ${quotes[t].price.toFixed(2)}</div>
    {quotes[t].change_pct !== null && (
      <div
        style={{
          color: quotes[t].change_pct >= 0 ? "#22c55e" : "#ef4444",
          fontWeight: 900,
        }}
      >
        {quotes[t].change_pct >= 0 ? "+" : ""}
        {quotes[t].change_pct.toFixed(2)}%
      </div>
    )}
  </div>
) : (
  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
    Price loading…
  </div>
)}

<div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
  Open details →
</div>

                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
