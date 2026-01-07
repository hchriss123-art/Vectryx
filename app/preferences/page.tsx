"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

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

export default function PreferencesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  // form fields
  const [watchlistText, setWatchlistText] = useState("");
  const [insiderMinUsd, setInsiderMinUsd] = useState<number>(25000);
  const [alertFrequency, setAlertFrequency] = useState<"REALTIME" | "DAILY_DIGEST">("REALTIME");
  const [quietStart, setQuietStart] = useState<string>("");
  const [quietEnd, setQuietEnd] = useState<string>("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  const tickerCount = useMemo(() => parseTickers(watchlistText).length, [watchlistText]);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setStatus(null);

      if (!supabase) {
        setStatus("Supabase is not configured. Check environment variables.");
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);

      const { data: prefRow } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const p = (prefRow as UserPrefs | null) ?? null;

      if (p) {
        setWatchlistText(p.watchlist_text ?? "");
        setInsiderMinUsd(Number(p.insider_min_usd ?? 25000));
        setAlertFrequency(p.alert_frequency ?? "REALTIME");
        setQuietStart(p.quiet_hours_start ?? "");
        setQuietEnd(p.quiet_hours_end ?? "");
        setNotifyEmail(!!p.notify_email);
        setNotifyPush(!!p.notify_push);
        setNotifySms(!!p.notify_sms);
      }

      setLoading(false);
    };

    boot();
  }, [supabase]);

  const save = async () => {
    if (!userId) return;

    if (!supabase) {
      setStatus("Supabase is not configured. Check environment variables.");
      return;
    }

    setSaving(true);
    setStatus(null);

    const payload: Partial<UserPrefs> = {
      user_id: userId,
      watchlist_text: watchlistText,
      insider_min_usd: insiderMinUsd,
      alert_frequency: alertFrequency,
      quiet_hours_start: quietStart || null,
      quiet_hours_end: quietEnd || null,
      notify_email: notifyEmail,
      notify_push: notifyPush,
      notify_sms: notifySms,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("user_preferences").upsert(payload, { onConflict: "user_id" });
    if (error) {
      setStatus(error.message);
      setSaving(false);
      return;
    }

    setStatus("Preferences saved ✅");
    setSaving(false);
  };

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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h1 style={{ fontSize: "clamp(30px, 4.8vw, 44px)", margin: 0, fontWeight: 950, letterSpacing: -0.5 }}>
              Preferences
            </h1>

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
              ← Back to Dashboard
            </Link>
          </div>

          <p
            style={{
              fontSize: "clamp(14px, 3.6vw, 16px)",
              opacity: 0.9,
              lineHeight: 1.6,
              marginTop: 12,
              maxWidth: 900,
            }}
          >
            Set the watchlist and rules that determine what signals are worth your attention.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "18px 18px 44px" }}>
        {loading ? <div style={{ opacity: 0.8 }}>Loading preferences…</div> : null}

        {status ? (
          <div
            className="vx-mobile-card"
            style={{
              border: "1px solid rgba(148,163,184,0.20)",
              background: "rgba(2, 6, 23, 0.35)",
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            {status}
          </div>
        ) : null}

        <Card title={`Watchlist (${tickerCount})`}>
          <div style={{ opacity: 0.85, lineHeight: 1.6, marginBottom: 10 }}>
            Enter tickers separated by commas. Example: <strong>AAPL, MSFT, NVDA</strong>
          </div>

          <textarea
            value={watchlistText}
            onChange={(e) => setWatchlistText(e.target.value)}
            rows={4}
            style={inputArea}
            placeholder="AAPL, MSFT, NVDA"
          />
        </Card>

        <Card title="Signal Thresholds">
          <Row label="Insider min USD">
            <input value={insiderMinUsd} onChange={(e) => setInsiderMinUsd(Number(e.target.value))} type="number" style={inputText} />
          </Row>

          <Row label="Alert frequency">
            <select value={alertFrequency} onChange={(e) => setAlertFrequency(e.target.value as any)} style={inputText}>
              <option value="REALTIME">REALTIME</option>
              <option value="DAILY_DIGEST">DAILY_DIGEST</option>
            </select>
          </Row>

          <Row label="Quiet hours start (optional)">
            <input value={quietStart} onChange={(e) => setQuietStart(e.target.value)} placeholder="17:00" style={inputText} />
          </Row>

          <Row label="Quiet hours end (optional)">
            <input value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} placeholder="07:00" style={inputText} />
          </Row>
        </Card>

        <Card title="Notification Channels">
          <Toggle label="Email" checked={notifyEmail} onChange={setNotifyEmail} />
          <Toggle label="Push" checked={notifyPush} onChange={setNotifyPush} />
          <Toggle label="SMS" checked={notifySms} onChange={setNotifySms} />
        </Card>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={save} disabled={saving} style={primaryBtn}>
            {saving ? "Saving…" : "Save Preferences"}
          </button>

          <Link href="/pricing" style={ghostLink}>
            View Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}

/* ---- components ---- */

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div
      className="vx-mobile-card"
      style={{
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(2, 6, 23, 0.35)",
        borderRadius: 18,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 12 }}>
      <div style={{ fontWeight: 900, opacity: 0.9 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontWeight: 900 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ opacity: 0.92 }}>{label}</span>
    </label>
  );
}

/* ---- helpers/styles ---- */

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

const inputText: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
  fontWeight: 800,
};

const inputArea: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
  fontWeight: 800,
  resize: "vertical",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "white",
  color: "#0f172a",
  fontWeight: 950,
  cursor: "pointer",
};

const ghostLink: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "transparent",
  color: "white",
  textDecoration: "none",
  fontWeight: 950,
};
