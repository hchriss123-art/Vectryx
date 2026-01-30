"use client";

import Navbar from "@/components/Navbar";
import { HeroSignalCard } from "@/components/HeroSignalCard";
import { RecentSignals } from "@/components/RecentSignals";
import { WatchlistCoverage } from "@/components/WatchlistCoverage";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { CSSProperties } from "react";

/* ---- types + constants ---- */

type AccessStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";
type Plan = "FREE" | "PRO" | "MORPHEUS";

type UserProfile = {
  user_id: string;
  full_name: string | null;
  morpheus_access: AccessStatus;
  stock_jockey_access: boolean;
  plan?: Plan;
  extra_ticker_blocks?: number;
};

type UserPrefs = {
  user_id: string;
  watchlist_text: string;
  insider_min_usd: number;
  alert_frequency: "REALTIME" | "DAILY_DIGEST";
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  notify_push: boolean;
  updated_at?: string | null;
};

type AlertEvent = {
  id: number;
  user_id: string;
  product: string | null;
  event_type: string | null;
  title: string | null;
  body: string | null;
  ticker: string | null;
  severity: string | null;
  occurred_at: string | null;
  dedupe_key: string | null;
  notify_status?: string | null;
};

type Confidence = "Very Strong" | "Strong" | "Moderate" | "Weak";

type WatchlistQuote = {
  ticker: string;
  price: number;
  change_pct: number | null;
  created_at: string;
};

const BASE_LIMIT_BY_PLAN: Record<Plan, number> = {
  FREE: 5,
  PRO: 15,
  MORPHEUS: 50, // internal tier label (branded as Vectryx)
};

const POLL_MS = 12_000; // alert_event polling
const RECENT_LIMIT = 25;

// quote polling fallback (realtime should make this mostly unnecessary, but it’s a safety net)
const QUOTE_POLL_MS = 30_000;

export default function DashboardClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const pollTimer = useRef<number | null>(null);
  const quotePollTimer = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [recentEvents, setRecentEvents] = useState<AlertEvent[]>([]);
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);

  // Watchlist quotes (for ticker tape + anywhere else)
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const [quotesLastUpdated, setQuotesLastUpdated] = useState<Date | null>(null);

  const plan: Plan = (profile?.plan as Plan) ?? "FREE";
  const extraBlocks = Number(profile?.extra_ticker_blocks ?? 0);
  const tickerLimit = (BASE_LIMIT_BY_PLAN[plan] ?? 5) + Math.max(0, extraBlocks) * 10;

  const tickers = useMemo(() => parseTickers(prefs?.watchlist_text ?? ""), [prefs?.watchlist_text]);
  const tickerCount = tickers.length;

  const usagePct = useMemo(() => {
    if (!tickerLimit) return 0;
    return Math.min(100, Math.round((tickerCount / tickerLimit) * 100));
  }, [tickerCount, tickerLimit]);

  const planLabel = plan === "MORPHEUS" ? "VECTRYX" : plan;

  // For WatchlistCoverage: last evaluation can be last prefs update (fine for now)
  const lastEvaluationAgo = useMemo(() => {
    const t = prefs?.updated_at ? new Date(prefs.updated_at) : new Date(Date.now() - 10 * 60 * 1000);
    return timeAgo(t);
  }, [prefs?.updated_at]);

  const lastScanLabel = useMemo(() => {
    if (!lastPollAt) return "—";
    return fmtTime(lastPollAt);
  }, [lastPollAt]);

  const nextScanLabel = useMemo(() => {
    if (!lastPollAt) return "—";
    return fmtTime(new Date(lastPollAt.getTime() + POLL_MS));
  }, [lastPollAt]);

  const hero = useMemo(() => {
    const e = recentEvents?.[0];
    if (!e || !e.ticker) {
      return prefs ? ({ state: "empty", lastEvaluationAgo } as const) : ({ state: "loading" } as const);
    }

    const ticker = (e.ticker || "").toUpperCase();
    const companyName = ticker; // placeholder until you add a symbol->name mapping table
    const signalType = e.title || e.event_type || "Signal Event";
    const detectedAgo = e.occurred_at ? timeAgo(new Date(e.occurred_at)) : "moments ago";
    const confidence = severityToConfidence(e.severity);

    return {
      state: "active",
      companyName,
      ticker,
      signalType,
      confidence,
      detectedAgo,
      recentActivity: e.product ? `Source: ${e.product}` : undefined,
      whyThisMatters: e.body || undefined,
      href: `/app/dashboard/${ticker}`,
    } as const;
  }, [recentEvents, prefs, lastEvaluationAgo]);

const recentSignalCards = useMemo(() => {
  const cleaned = (recentEvents || []).filter((e) => !!e.ticker);

  const seen = new Set<string>();
  const out: Array<{
    companyName: string;
    ticker: string;
    signalType: string;
    confidence: Confidence;
    detectedAgo: string;
    whyThisMatters?: string;
    href: string;
    source?: string;
  }> = [];

  for (const e of cleaned) {
    const ticker = (e.ticker || "").toUpperCase();
    const key = `${ticker}|${e.event_type || ""}|${e.title || ""}|${e.occurred_at || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      companyName: ticker,
      ticker,
      signalType: e.title || e.event_type || "Signal Event",
      confidence: severityToConfidence(e.severity),
      detectedAgo: e.occurred_at ? timeAgo(new Date(e.occurred_at)) : "moments ago",
      whyThisMatters: e.body || undefined,
      href: `/app/dashboard/${ticker}`,
      source: sourceLabel(e.product),
    });

    if (out.length >= 5) break;
  }

  return out;
}, [recentEvents])

  // BOOT: profile + prefs
  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setStatusMsg(null);

      const sb = supabase;
      if (!sb) {
        setStatusMsg("Supabase is not configured. Check Vercel environment variables.");
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
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

      // Profile
      const { data: prof, error: profErr } = await sb
        .from("user_profile")
        .select("user_id, full_name, morpheus_access, stock_jockey_access, plan, extra_ticker_blocks")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profErr) {
        setStatusMsg(profErr.message);
        setLoading(false);
        return;
      }
      setProfile((prof as UserProfile | null) ?? null);

      // Preferences
      const { data: prefRow, error: prefErr } = await sb
        .from("user_preferences")
        .select(
          "user_id, watchlist_text, insider_min_usd, alert_frequency, quiet_hours_start, quiet_hours_end, notify_email, notify_sms, notify_push, updated_at"
        )
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

  // Poll alert_event (REAL)
  useEffect(() => {
    const startPolling = async () => {
      const sb = supabase;
      if (!sb) return;

      const { data: sessionData } = await sb.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const runOnce = async () => {
        const filterTickers = tickers;

        let q = sb
          .from("alert_event")
          .select("id,user_id,product,event_type,title,body,ticker,severity,occurred_at,dedupe_key,notify_status")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(RECENT_LIMIT);

        if (filterTickers.length > 0) {
          q = q.in("ticker", filterTickers);
        }

        const { data, error } = await q;
        if (error) {
          setStatusMsg(error.message);
          return;
        }

        setRecentEvents((data as AlertEvent[]) ?? []);
        setLastPollAt(new Date());
      };

      await runOnce();

      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = window.setInterval(runOnce, POLL_MS);
    };

    startPolling();

    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [supabase, tickers.join("|")]);

  // Quotes: initial load + fallback polling
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let cancelled = false;

    const loadQuotesOnce = async () => {
      const { data: sessionData } = await sb.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || cancelled) return;

      const { data, error } = await sb
        .from("watchlist_quote")
        .select("ticker, price, change_pct, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) return;

      // keep latest per ticker
      const latest: Record<string, WatchlistQuote> = {};
      for (const row of (data as any[]) ?? []) {
        const t = String(row.ticker || "").toUpperCase();
        if (!t) continue;
        if (!latest[t]) latest[t] = { ...row, ticker: t };
      }

      setQuotes(latest);
      setQuotesLastUpdated(new Date());
    };

    loadQuotesOnce();

    if (quotePollTimer.current) window.clearInterval(quotePollTimer.current);
    quotePollTimer.current = window.setInterval(loadQuotesOnce, QUOTE_POLL_MS);

    return () => {
      cancelled = true;
      if (quotePollTimer.current) window.clearInterval(quotePollTimer.current);
      quotePollTimer.current = null;
    };
  }, [supabase, tickers.join("|")]);

  // Quotes: REALTIME subscription (INSERT on watchlist_quote)
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let channel: any = null;
    let cancelled = false;

    const setup = async () => {
      const { data: sessionData } = await sb.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || cancelled) return;

      channel = sb
        .channel(`watchlist_quote_${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "watchlist_quote", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            const row = payload?.new;
            if (!row?.ticker) return;

            const t = String(row.ticker).toUpperCase();

            setQuotes((prev) => {
              const existing = prev?.[t];
              if (!existing) return { ...prev, [t]: { ...row, ticker: t } };

              const prevTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
              const newTime = row.created_at ? new Date(row.created_at).getTime() : Date.now();

              if (newTime >= prevTime) {
                return { ...prev, [t]: { ...row, ticker: t } };
              }
              return prev;
            });

            setQuotesLastUpdated(new Date());
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220" }}>
      <Navbar />

      {/* Header band */}
      <div style={{ background: "linear-gradient(135deg, #0f172a, #020617)", color: "white" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 18px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Vectryx</div>
                <Pill text="BETA" />
                <Pill text={`Plan: ${planLabel}`} tone="info" />
              </div>

              <h1
                style={{
                  fontSize: "clamp(30px, 4.6vw, 44px)",
                  margin: "10px 0 6px 0",
                  fontWeight: 950,
                  letterSpacing: -0.4,
                }}
              >
                Dashboard
              </h1>

              <div style={{ opacity: 0.86, fontSize: "clamp(14px, 3.4vw, 16px)", lineHeight: 1.55, maxWidth: 820 }}>
                Live signals from Morpheus → Supabase → Vectryx.
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SmallStat label="Last poll" value={lastScanLabel} />
                <SmallStat label="Next poll" value={nextScanLabel} />
                <SmallStat label="Preferences updated" value={prefs?.updated_at ? fmtTime(new Date(prefs.updated_at)) : "Not set"} />
                <SmallStat label="Quotes updated" value={quotesLastUpdated ? fmtTime(quotesLastUpdated) : "—"} />
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            <KpiCard
              title="Signal Engine"
              value="ACTIVE"
              subtitle="Watchlists • Alerts • Scoring"
              meta={`Polling: every ${Math.round(POLL_MS / 1000)}s`}
            />

            <KpiCard
              title="Access"
              value={profile?.morpheus_access ?? "—"}
              subtitle="Private beta controls"
              meta={profile?.morpheus_access === "APPROVED" ? "Unlocked ✅" : "Approval required"}
            />

            <KpiCard
              title="Watchlist Capacity"
              value={`${tickerCount}/${tickerLimit}`}
              subtitle={`Usage: ${usagePct}%`}
              meta={`Extra blocks: ${extraBlocks} (+${extraBlocks * 10})`}
              progressPct={usagePct}
            />

            <KpiCard
              title="Alert Channels"
              value={prefs ? channelsLabel(prefs) : "—"}
              subtitle="Email • Push • SMS"
              meta={prefs ? quietHoursLabel(prefs) : "Set in Preferences"}
            />
          </div>

          {/* Hero Signal (REAL) */}
          <div style={{ marginTop: 14 }}>
            <HeroSignalCard data={hero as any} />
          </div>

          {/* Recent Signals (REAL) */}
          <div style={{ marginTop: 14 }}>
            <RecentSignals items={recentSignalCards} />
          </div>

          {/* Watchlist Coverage */}
          <div style={{ marginTop: 14 }}>
            <WatchlistCoverage monitoredCount={tickerCount} capacity={tickerLimit} planLabel={planLabel} lastEvaluationAgo={lastEvaluationAgo} hrefManage="/preferences" />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 18px 34px" }}>
        {loading ? <div style={{ color: "rgba(255,255,255,0.72)" }}>Loading…</div> : null}
        {statusMsg ? <div style={statusBox}>{statusMsg}</div> : null}
      </div>

      {/* Bottom ticker tape */}
      <TickerTape tickers={tickers} quotes={quotes} />
    </main>
  );
}

/** Ticker tape */

function TickerTape(props: { tickers: string[]; quotes: Record<string, WatchlistQuote> }) {
  const items = (props.tickers || []).map((t) => {
    const q = props.quotes?.[t];
    const price = q?.price != null ? Number(q.price) : null;
    const pct = q?.change_pct != null ? Number(q.change_pct) : null;
    return { t, price, pct };
  });

  // duplicate to create a seamless loop
  const loop = [...items, ...items];

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 44,
        borderTop: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(2, 6, 23, 0.92)",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      <style>{`
        @keyframes vx_tape_scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          width: "max-content",
          gap: 22,
          paddingLeft: 18,
          alignItems: "center",
          height: "100%",
          whiteSpace: "nowrap",
          animation: "vx_tape_scroll 35s linear infinite",
        }}
      >
        {loop.map((x, i) => (
          <div key={`${x.t}-${i}`} style={{ display: "flex", gap: 10, alignItems: "center", color: "rgba(255,255,255,0.92)" }}>
            <span style={{ fontWeight: 950 }}>{x.t}</span>
            <span style={{ opacity: 0.85 }}>
              {x.price == null ? "—" : `$${x.price.toFixed(2)}`}
            </span>
            {x.pct == null ? (
              <span style={{ opacity: 0.55 }}> </span>
            ) : (
              <span style={{ fontWeight: 900, opacity: 0.95 }}>
                {x.pct >= 0 ? "▲" : "▼"} {Math.abs(x.pct).toFixed(2)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** UI helpers */

function KpiCard(props: { title: string; value: string; subtitle: string; meta?: string; progressPct?: number }) {
  return (
    <div
      className="vx-mobile-card"
      style={{
        border: "1px solid rgba(148,163,184,0.25)",
        background: "rgba(2, 6, 23, 0.35)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{props.title}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: "white" }}>{props.value}</div>
      <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>{props.subtitle}</div>

      {typeof props.progressPct === "number" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.12)" }}>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                width: `${props.progressPct}%`,
                background: "rgba(255,255,255,0.55)",
              }}
            />
          </div>
        </div>
      )}

      {props.meta ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.82 }}>{props.meta}</div> : null}
    </div>
  );
}

function Pill(props: { text: string; tone?: "normal" | "info" }) {
  const info = props.tone === "info";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "5px 10px",
        borderRadius: 999,
        border: `1px solid ${info ? "rgba(56,189,248,0.35)" : "rgba(148,163,184,0.25)"}`,
        background: info ? "rgba(56,189,248,0.10)" : "rgba(148,163,184,0.10)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {props.text}
    </span>
  );
}

function SmallStat(props: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(2, 6, 23, 0.25)",
        borderRadius: 12,
        padding: "8px 10px",
        minWidth: 150,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.72 }}>{props.label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 3 }}>{props.value}</div>
    </div>
  );
}

/** Data helpers */

function parseTickers(raw: string) {
  const parts = raw
    .split(/[\s,]+/g)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function channelsLabel(p: UserPrefs) {
  const list = [p.notify_email ? "Email" : null, p.notify_push ? "Push" : null, p.notify_sms ? "SMS" : null].filter(Boolean) as string[];
  return list.length ? list.join(", ") : "None";
}

function quietHoursLabel(p: UserPrefs) {
  return p.quiet_hours_start && p.quiet_hours_end ? `${p.quiet_hours_start} → ${p.quiet_hours_end}` : "(not set)";
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const s = Math.max(1, Math.floor(diffMs / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h >= 1) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (m >= 1) return `${m} minute${m === 1 ? "" : "s"} ago`;
  return `${s} seconds ago`;
}

function severityToConfidence(sev?: string | null): Confidence {
  const s = String(sev || "").toLowerCase();
  if (s.includes("critical") || s.includes("very strong")) return "Very Strong";
  if (s.includes("high") || s.includes("strong")) return "Strong";
  if (s.includes("med") || s.includes("moderate")) return "Moderate";
  return "Weak";
}
function sourceLabel(product?: string | null) {
  const p = String(product || "").trim().toLowerCase();

  // Vectryx umbrella product name (what your table is using now)
  if (p === "vectryx") return "Market/Price Action";

  // If you later split producers, these will show correctly:
  if (p === "morpheus") return "Insider";
  if (p === "stockjockey" || p === "stock_jockey") return "Market/Price Action";
  if (p === "watchlist") return "Watchlist";
  if (p === "news") return "News";
  if (p === "technical") return "Technical";

  // default
  return "General";
}

/** Styles */

const statusBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.20)",
  background: "rgba(2, 6, 23, 0.35)",
  color: "rgba(255,255,255,0.92)",
};
