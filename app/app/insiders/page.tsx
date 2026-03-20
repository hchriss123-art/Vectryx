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

type FilterKey = "ALL" | "BUY" | "SELL" | "USD_100K" | "USD_500K" | "USD_1M";

function safeNum(x: number | null | undefined) {
  return typeof x === "number" && !Number.isNaN(x) ? x : 0;
}

/**
 * Fixes mismatched labels like:
 * - transaction_code = "P"
 * - shares/value are negative
 *
 * In that case we treat the visible type as SELL-like for display.
 */
function effectiveTxCode(row: InsiderEvent) {
  const raw = String(row.transaction_code || "").toUpperCase().trim();
  const shares = safeNum(row.shares);
  const value = safeNum(row.value);

  if ((raw === "P" || raw === "S" || !raw) && (shares < 0 || value < 0)) {
    return "S";
  }

  if ((raw === "P" || raw === "S" || !raw) && (shares > 0 || value > 0)) {
    return "P";
  }

  return raw || "—";
}

function txLabelFromCode(code?: string | null) {
  const c = (code || "").toUpperCase().trim();
  if (!c || c === "—") return "—";

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

function txBadgeForRow(row: InsiderEvent) {
  const c = effectiveTxCode(row);
  const label = txLabelFromCode(c);

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

function money(x: number | null) {
  if (x === null || x === undefined) return "—";
  return "$" + Math.round(x).toLocaleString();
}

function num(x: number | null) {
  if (x === null || x === undefined) return "—";
  return Math.round(x).toLocaleString();
}

function absMoneyValue(x: number | null) {
  return Math.abs(safeNum(x));
}

function meetsFilter(r: InsiderEvent, f: FilterKey) {
  const code = effectiveTxCode(r);
  const vAbs = absMoneyValue(r.value);

  switch (f) {
    case "BUY":
      return code === "P";
    case "SELL":
      return code === "S";
    case "USD_100K":
      return vAbs >= 100_000;
    case "USD_500K":
      return vAbs >= 500_000;
    case "USD_1M":
      return vAbs >= 1_000_000;
    case "ALL":
    default:
      return true;
  }
}

/**
 * Collapse obvious duplicates for display.
 * This does NOT delete from DB — it only cleans the feed shown to users.
 */
function dedupeRows(rows: InsiderEvent[]) {
  const seen = new Set<string>();
  const out: InsiderEvent[] = [];

  for (const r of rows) {
    const key = [
      (r.ticker || "").toUpperCase().trim(),
      (r.insider_name || "").trim().toUpperCase(),
      (r.transaction_date || "").trim(),
      effectiveTxCode(r),
      safeNum(r.shares),
      safeNum(r.price),
      safeNum(r.value),
      (r.detail_url || "").trim(),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

export default function InsidersPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<InsiderEvent[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");

  async function load(isBackground = false) {
    const sb = supabase;
    if (!sb) {
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }

    if (isBackground) setRefreshing(true);
    else setInitialLoading(true);

    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Pull more than 200 so we can de-duplicate before showing the final 200
    const { data, error } = await sb
      .from("insider_event")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      const deduped = dedupeRows(data as InsiderEvent[]).slice(0, 200);
      setRows(deduped);
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

  const q = query.trim().toLowerCase();

  const filtered = rows
    .filter((r) => meetsFilter(r, filter))
    .filter((r) => {
      if (!q) return true;
      const t = String(r.ticker || "").toLowerCase();
      const insider = String(r.insider_name || "").toLowerCase();
      const issuer = String(r.issuer_name || "").toLowerCase();
      const tx = String(effectiveTxCode(r) || "").toLowerCase();
      return t.includes(q) || insider.includes(q) || issuer.includes(q) || tx.includes(q);
    });

  const statusLine = initialLoading
    ? "Loading…"
    : `Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} unique events${
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

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <FilterPill active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" />
          <FilterPill active={filter === "BUY"} onClick={() => setFilter("BUY")} label="Purchases" />
          <FilterPill active={filter === "SELL"} onClick={() => setFilter("SELL")} label="Sales" />
          <FilterPill active={filter === "USD_100K"} onClick={() => setFilter("USD_100K")} label="$100k+" />
          <FilterPill active={filter === "USD_500K"} onClick={() => setFilter("USD_500K")} label="$500k+" />
          <FilterPill active={filter === "USD_1M"} onClick={() => setFilter("USD_1M")} label="$1M+" />

          <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 13 }}>{statusLine}</div>
        </div>

        {initialLoading && rows.length === 0 ? <div style={{ marginTop: 18 }}>Loading…</div> : null}

        {!initialLoading || rows.length > 0 ? (
          <div
            style={{
              marginTop: 14,
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

                      <td style={tdStyle}>{txBadgeForRow(r)}</td>
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

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(148,163,184,0.22)",
        background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 950,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
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