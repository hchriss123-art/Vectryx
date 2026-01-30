"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

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

function safeUpper(s: any) {
  const v = String(s ?? "").trim();
  return v ? v.toUpperCase() : "";
}

export default function SignalsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      setLoading(true);
      setStatus(null);

      const sb = supabase;
      if (!sb) {
        setStatus("Supabase is not configured. Check environment variables.");
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
      if (sessionErr) {
        setStatus(sessionErr.message);
        setLoading(false);
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await sb
        .from("alert_event")
        .select("id,user_id,product,event_type,title,body,ticker,severity,occurred_at,dedupe_key,notify_status")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(200);

      if (!mounted) return;

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      setEvents((data as AlertEvent[]) ?? []);
      setLoading(false);
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "white" }}>
      <Navbar />

      <section
        style={{
          background: "linear-gradient(135deg, #0f172a, #020617)",
          borderBottom: "1px solid rgba(148,163,184,0.18)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "38px 18px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>All Signals</div>
              <h1 style={{ fontSize: "clamp(30px, 4.8vw, 44px)", margin: "6px 0 0", fontWeight: 950, letterSpacing: -0.5 }}>
                SIGNALS
              </h1>
              <div style={{ marginTop: 8, opacity: 0.88, lineHeight: 1.6 }}>
                A list of your latest alerts from <strong>alert_event</strong> across all tickers.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/app/dashboard/watchlist"
                style={{
                  background: "transparent",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 900,
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                ← Watchlist
              </Link>

              <Link
                href="/app/dashboard"
                style={{
                  background: "transparent",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 900,
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.28)",
                }}
              >
                ← Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "18px 18px 44px" }}>
        {loading ? <div style={{ opacity: 0.8 }}>Loading signals…</div> : null}

        {status ? (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.20)",
              background: "rgba(2, 6, 23, 0.35)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            {status}
          </div>
        ) : null}

        <div
          className="vx-mobile-card"
          style={{
            border: "1px solid rgba(148,163,184,0.20)",
            background: "rgba(2, 6, 23, 0.35)",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 16 }}>Recent alerts</div>
          <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.6 }}>
            Showing up to <strong>200</strong> recent events across your tickers.
          </div>

          {!events || events.length === 0 ? (
            <div style={{ marginTop: 14, opacity: 0.86 }}>
              No events yet. When Morpheus writes rows into <strong>alert_event</strong>, they will show here.
            </div>
          ) : (
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {events.map((e) => {
                const t = safeUpper(e.ticker);
                const href = t ? `/app/dashboard/${t}` : "/app/dashboard";

                return (
                  <a
                    key={e.id}
                    href={href}
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: "rgba(255,255,255,0.92)",
                      border: "1px solid rgba(148,163,184,0.20)",
                      background: "rgba(2, 6, 23, 0.25)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950, fontSize: 15 }}>
                        {e.title || e.event_type || "Alert Event"}
                        {t ? <span style={{ opacity: 0.65 }}> • {t}</span> : null}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}
                      </div>
                    </div>

                    {e.body ? <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>{e.body}</div> : null}

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.85 }}>
                      <Tag label={`Severity: ${e.severity ?? "—"}`} />
                      <Tag label={`Product: ${e.product ?? "—"}`} />
                      <Tag label={`Notify: ${e.notify_status ?? "—"}`} />
                    </div>

                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900 }}>
                      {t ? "Open ticker details →" : "Back to dashboard →"}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.25)",
        background: "rgba(148,163,184,0.10)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {label}
    </span>
  );
}
