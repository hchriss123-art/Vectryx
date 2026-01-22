"use client";

import Navbar from "@/components/Navbar";
import { HeroSignalCard } from "@/components/HeroSignalCard";
import { RecentSignals } from "@/components/RecentSignals";
import { WatchlistCoverage } from "@/components/WatchlistCoverage";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

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

const BASE_LIMIT_BY_PLAN: Record<Plan, number> = {
  FREE: 5,
  PRO: 15,
  MORPHEUS: 50, // internal tier label (branded as Vectryx)
};

const POLL_MS = 12_000; // 12 seconds (tweak as you like)
const RECENT_LIMIT = 25;

export default function DashboardClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const pollTimer = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [recentEvents, setRecentEvents] = useState<AlertEvent[]>([]);
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);
  const [tickerCoverage, setTickerCoverage] = useState<Record<string, AlertEvent | null>>({});

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
      return prefs
        ? ({ state: "empty", lastEvaluationAgo } as const)
        : ({ state: "loading" } as const);
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
    // Only show events that have a ticker
    const cleaned = (recentEvents || []).filter((e) => !!e.ticker);

    // De-dupe: ticker + event_type/title + occurred_at
    const seen = new Set<string>();
    const out: Array<{
      companyName: string;
      ticker: string;
      signalType: string;
      confidence: Confidence;
      detectedAgo: string;
      whyThisMatters?: string;
      href: string;
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
      });

      if (out.length >= 5) break;
    }

    return out;
  }, [recentEvents]);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setStatusMsg(null);

      if (!supabase) {
        setStatusMsg("Supabase is not configured. Check Vercel environment variables.");
        setLoading(false);
        return;
      }

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

      // Profile
      const { data: prof, error: profErr } = await supabase
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
      const { data: prefRow, error: prefErr } = await supabase
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

  // Poll alert_event (real data)
  useEffect(() => {
    const startPolling = async () => {
      if (!supabase) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const runOnce = async () => {
        // only poll if user has tickers (optional; you can remove this gate)
        const filterTickers = tickers;

        let q = supabase
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
        // Coverage fetch: pull enough rows to find the latest event per ticker (REAL data)
const COVERAGE_LIMIT = 500;

let cq = supabase
  .from("alert_event")
  .select("id,user_id,product,event_type,title,body,ticker,severity,occurred_at,dedupe_key,notify_status")
  .eq("user_id", user.id)
  .order("occurred_at", { ascending: false })
  .limit(COVERAGE_LIMIT);

if (filterTickers.length > 0) {
  cq = cq.in("ticker", filterTickers);
}

const { data: coverageRows, error: coverageErr } = await cq;

if (!coverageErr) {
  // Initialize all tickers as "no alerts yet"
  const map: Record<string, AlertEvent | null> = {};
  for (const t of filterTickers) map[t] = null;

  // Because rows are newest→oldest, the first row per ticker is the latest
  for (const row of (coverageRows as AlertEvent[]) ?? []) {
    const t = String(row.ticker ?? "").toUpperCase();
    if (!t || !(t in map)) continue;
    if (map[t] == null) map[t] = row;
  }

  setTickerCoverage(map);
}
        setLastPollAt(new Date());
      };

      // initial fetch
      await runOnce();

      // interval
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = window.setInterval(runOnce, POLL_MS);
    };

    startPolling();

    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [supabase, tickers.join("|")]); // re-poll when watchlist changes

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
          {/* Tracked Tickers (REAL coverage of all tickers in plan/watchlist) */}
<div style={{ marginTop: 14 }}>
  <section
    className="vx-mobile-card"
    style={{
      border: "1px solid rgba(148,163,184,0.25)",
      borderRadius: 16,
      background: "rgba(2, 6, 23, 0.35)",
      padding: 18,
      color: "white",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Tracked Tickers</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
          Showing {tickerCount} / {tickerLimit} tickers in your watchlist.
        </div>
      </div>

      <a
        href="/app/dashboard/watchlist"
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
        Watchlist →
      </a>
    </div>

    {tickers.length === 0 ? (
      <div style={{ marginTop: 12, opacity: 0.85 }}>No tickers in your watchlist yet.</div>
    ) : (
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {tickers.map((t) => {
          const last = tickerCoverage?.[t] ?? null;
          const lastTime = last?.occurred_at ? new Date(last.occurred_at).toLocaleString() : null;
          const sev = String(last?.severity ?? "").toUpperCase();

          return (
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

              {last ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900 }}>Status: Active{sev ? ` • ${sev}` : ""}</div>
                  <div style={{ marginTop: 4 }}>Last alert: {lastTime ?? "—"}</div>
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 900 }}>Status: No alerts yet</div>
                </div>
              )}
            </a>
          );
        })}
      </div>
    )}
  </section>
</div>

          {/* Watchlist Coverage */}
          <div style={{ marginTop: 14 }}>
            <WatchlistCoverage
              monitoredCount={tickerCount}
              capacity={tickerLimit}
              planLabel={planLabel}
              lastEvaluationAgo={lastEvaluationAgo}
              hrefManage="/preferences"
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 18px 34px" }}>
        {loading ? <div style={{ color: "rgba(255,255,255,0.72)" }}>Loading…</div> : null}
        {statusMsg ? <div style={statusBox}>{statusMsg}</div> : null}
      </div>
    </main>
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
    .split(",")
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

/** Styles */

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.20)",
  background: "rgba(2, 6, 23, 0.35)",
  color: "rgba(255,255,255,0.92)",
};
