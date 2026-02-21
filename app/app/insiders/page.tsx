"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type InsiderEvent = {
  id: string;
  ticker: string;
  insider_name: string | null;
  issuer_name: string | null;
  transaction_code?: string | null;
  shares: number | null;
  price: number | null;
  value: number | null;
  transaction_date: string | null;
  detail_url: string | null;
  created_at: string | null;
};

function txLabel(code?: string | null) {
  const c = (code || "").toUpperCase().trim();
  if (!c) return "—";
  switch (c) {
    case "P":
      return "Purchase";
    case "S":
      return "Sell";
    case "M":
      return "Option Exercise";
    case "A":
      return "Grant/Award";
    case "F":
      return "Tax/Withholding";
    case "D":
      return "Disposition";
    case "J":
      return "Other";
    default:
      return c;
  }
}

function txBadge(code?: string | null) {
  const c = (code || "").toUpperCase().trim();
  const label = txLabel(c);

  const isBuy = c === "P";
  const isSell = c === "S";

  const bg = isBuy ? "rgba(34,197,94,0.14)" : isSell ? "rgba(239,68,68,0.14)" : "rgba(148,163,184,0.14)";
  const bd = isBuy ? "rgba(34,197,94,0.35)" : isSell ? "rgba(239,68,68,0.35)" : "rgba(148,163,184,0.30)";
  const fg = isBuy ? "rgba(187,247,208,0.95)" : isSell ? "rgba(254,202,202,0.95)" : "rgba(255,255,255,0.85)";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${bd}`,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 950,
        whiteSpace: "nowrap",
      }}
      title={c ? `Code: ${c}` : "No transaction code"}
    >
      {label}
    </span>
  );
}

export default function InsidersPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<InsiderEvent[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);

  async function load(isBackground = false) {
    const sb = supabase;
    if (!sb) {
      setErrorMsg("Supabase client is not configured (missing env vars).");
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }

    if (isBackground) setRefreshing(true);
    else setInitialLoading(true);

    setErrorMsg(null);

    // ✅ HARD CHECK: must be logged in for RLS (auth.uid()) to match rows
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) {
      setErrorMsg(sessionErr.message);
      if (isBackground) setRefreshing(false);
      else setInitialLoading(false);
      return;
    }

    const user = sessionData.session?.user;
    if (!user) {
      // Not logged in on Vercel → RLS will hide rows → looks empty
      window.location.href = "/login";
      return;
    }

    setAuthedUserId(user.id);

    const { data, error } = await sb
      .from("insider_event")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setErrorMsg(error.message);
    } else if (data) {
      setRows(data as InsiderEvent[]);
      setLastUpdatedAt(new Date().toISOString());
    }

    if (isBackground) setRefreshing(false);
    else setInitialLoading(false);
  }

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function money(x: number | null) {
    if (x === null || x === undefined) return "—";
    return "$" + Math.round(x).toLocaleString();
  }

  function num(x: number | null) {
    if (x === null || x === undefined) return "—";
    return Math.round(x).toLocaleString();
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => {
        const t = String(r.ticker || "").toLowerCase();
        const insider = String(r.insider_name || "").toLowerCase();
        const issuer = String(r.issuer_name || "").toLowerCase();
        const tx = String(r.transaction_code || "").toLowerCase();
        return t.includes(q) || insider.includes(q) || issuer.includes(q) || tx.includes(q);
      })
    : rows;

  const statusLine = initialLoading
    ? "Loading…"
    : `Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} events${
        refreshing ? " • Refreshing…" : ""
      }${lastUpdatedAt ? ` • Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}`;

  return (
    <div
      style={{
        padding: 24,
        minHeight: "100vh",
        background: "linear-gradient(180deg, #020817 0%, #020617 100%)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 20,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 38, fontWeight: 900, margin: 0, letterSpacing: -0.6 }}>Insider Activity</h1>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker / insider / company / code…"
              style={searchInput}
            />

            <Link
              href="/app/dashboard"
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
                fontWeight: 900,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Status */}
        <div style={{ marginTop: 12, opacity: 0.75, fontSize: 13 }}>{statusLine}</div>

        {/* Debug (safe): confirms prod is logged in */}
        <div style={{ marginTop: 6, opacity: 0.55, fontSize: 12 }}>
          {authedUserId ? `Authenticated as: ${authedUserId}` : "Not authenticated (redirecting to login if needed)…"}
        </div>

        {errorMsg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "rgba(255,255,255,0.92)",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Supabase error: {errorMsg}
          </div>
        ) : null}

        {initialLoading && rows.length === 0 ? <div style={{ marginTop: 18 }}>Loading…</div> : null}

        {!initialLoading || rows.length > 0 ? (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    <th align="left" style={thStyle}>
                      Ticker
                    </th>
                    <th align="left" style={thStyle}>
                      Type
                    </th>
                    <th align="left" style={thStyle}>
                      Insider
                    </th>
                    <th align="left" style={thStyle}>
                      Date
                    </th>
                    <th align="right" style={thStyle}>
                      Shares
                    </th>
                    <th align="right" style={thStyle}>
                      Price
                    </th>
                    <th align="right" style={thStyle}>
                      Value
                    </th>
                    <th align="left" style={thStyle}>
                      Link
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900 }}>{(r.ticker || "").toUpperCase()}</div>
                        {r.issuer_name ? <div style={{ opacity: 0.7, fontSize: 12 }}>{r.issuer_name}</div> : null}
                      </td>

                      <td style={tdStyle}>{txBadge(r.transaction_code)}</td>
                      <td style={tdStyle}>{r.insider_name || "—"}</td>
                      <td style={tdStyle}>{r.transaction_date || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{num(r.shares)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{money(r.price)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{money(r.value)}</td>

                      <td style={tdStyle}>
                        {r.detail_url ? (
                          <a
                            href={r.detail_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "rgba(255,255,255,0.92)", fontWeight: 900, textDecoration: "underline" }}
                          >
                            Filing
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 ? (
                    <tr>
                      <td style={{ ...tdStyle, padding: 18 }} colSpan={8}>
                        No matches for <strong>{query || "your search"}</strong>.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "12px 12px",
  fontSize: 12,
  opacity: 0.75,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const tdStyle: CSSProperties = {
  padding: "12px 12px",
  verticalAlign: "top",
};

const searchInput: CSSProperties = {
  width: 320,
  maxWidth: "70vw",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.92)",
  outline: "none",
  fontWeight: 800,
};