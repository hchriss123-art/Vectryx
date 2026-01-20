"use client";

import Navbar from "@/components/Navbar";
import { HeroSignalCard } from "@/components/HeroSignalCard";
import { RecentSignals } from "@/components/RecentSignals";
import { WatchlistCoverage } from "@/components/WatchlistCoverage";
import { useEffect, useMemo, useState } from "react";
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

const BASE_LIMIT_BY_PLAN: Record<Plan, number> = {
  FREE: 5,
  PRO: 15,
  MORPHEUS: 50, // keep internal value for DB compatibility (we brand as Vectryx tier)
};

function tickerHref(ticker: string) {
  const t = (ticker || "").toUpperCase().trim();
  return `/app/dashboard/${encodeURIComponent(t)}`;
}

export default function DashboardClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const plan: Plan = (profile?.plan as Plan) ?? "FREE";
  const extraBlocks = Number(profile?.extra_ticker_blocks ?? 0);
  const tickerLimit = (BASE_LIMIT_BY_PLAN[plan] ?? 5) + Math.max(0, extraBlocks) * 10;

  const tickers = useMemo(() => parseTickers(prefs?.watchlist_text ?? ""), [prefs?.watchlist_text]);
  const tickerCount = tickers.length;

  const usagePct = useMemo(() => {
    if (!tickerLimit) return 0;
    return Math.min(100, Math.round((tickerCount / tickerLimit) * 100));
  }, [tickerCount, tickerLimit]);

  // Make it feel “live”
  const now = useMemo(() => new Date(), []);
  const lastScan = useMemo(() => new Date(now.getTime() - 7 * 60 * 1000), [now]); // 7 min ago
  const nextScan = useMemo(() => new Date(now.getTime() + 8 * 60 * 1000), [now]); // in 8 min

  // For WatchlistCoverage: if prefs exist, treat updated_at as last evaluation (good enough for demo)
  const lastEvaluationAgo = useMemo(() => {
    const t = prefs?.updated_at ? new Date(prefs.updated_at) : lastScan;
    return timeAgo(t);
  }, [prefs?.updated_at, lastScan]);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setStatusMsg(null);

      // Build-safe guard: if env vars aren't present, show a friendly message.
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

  const planLabel = plan === "MORPHEUS" ? "VECTRYX" : plan;

  // Pick a hero ticker:
  // - If user has a watchlist, use the first ticker
  // - Otherwise default to AAPL for demo
  const heroTicker = (tickers[0] ?? "AAPL").toUpperCase();

  // Build “recent signals” from watchlist (or demo fallback)
  const recentItems = useMemo(() => {
    const list = tickers.length ? tickers.slice(0, 5) : ["AAPL", "TSLA"];
    return list.map((t, idx) => ({
      companyName: t === "AAPL" ? "Apple Inc." : t === "TSLA" ? "Tesla, Inc." : `${t} (Company)`,
      ticker: t,
      signalType: idx % 2 === 0 ? "Executive Insider Purchase" : "Momentum Shift",
      confidence: idx % 2 === 0 ? ("Strong" as const) : ("Moderate" as const),
      detectedAgo: idx % 2 === 0 ? "2 hours ago" : "6 hours ago",
      whyThisMatters:
        idx % 2 === 0
          ? "Multiple executives increased exposure during consolidation."
          : "Price strength emerged after a multi-day base.",
      href: tickerHref(t),
    }));
  }, [tickers]);

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
                High-conviction signals only. Vectryx protects attention before capital is deployed.
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SmallStat label="Last scan" value={fmtTime(lastScan)} />
                <SmallStat label="Next scan" value={fmtTime(nextScan)} />
                <SmallStat
                  label="Preferences updated"
                  value={prefs?.updated_at ? fmtTime(new Date(prefs.updated_at)) : "Not set"}
                />
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
              meta={`Frequency: ${prefs?.alert_frequency ?? "—"}`}
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

          {/* Hero Signal */}
          <div style={{ marginTop: 14 }}>
            <HeroSignalCard
              data={
                prefs
                  ? {
                      state: "active",
                      companyName: heroTicker === "AAPL" ? "Apple Inc." : `${heroTicker} (Company)`,
                      ticker: heroTicker,
                      signalType: "Executive Insider Purchase",
                      confidence: "Strong",
                      detectedAgo: "2 hours ago",
                      recentActivity: "3 executive purchases",
                      whyThisMatters: "Executives increased exposure during a consolidation phase.",
                      // ✅ FIX: route that actually exists in your app
                      href: tickerHref(heroTicker),
                    }
                  : {
                      state: "empty",
                      lastEvaluationAgo: timeAgo(lastScan),
                    }
              }
            />
          </div>

          {/* Recent Signals */}
          <div style={{ marginTop: 14 }}>
            <RecentSignals items={recentItems} />
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
        {loading ? <div style={{ color: "rgba(255,255,255,0.72)" }}>Evaluating market activity…</div> : null}
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
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{props.value}</div>
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
  const list = [p.notify_email ? "Email" : null, p.notify_push ? "Push" : null, p.notify_sms ? "SMS" : null].filter(
    Boolean
  ) as string[];
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

/** Styles */

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.20)",
  background: "rgba(2, 6, 23, 0.35)",
  color: "rgba(255,255,255,0.92)",
};
