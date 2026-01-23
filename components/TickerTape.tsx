"use client";

type Quote = {
  ticker: string;
  price: number;
  change_pct: number | null;
  created_at: string;
};

function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function TickerTape(props: {
  tickers: string[];
  quotes: Record<string, Quote>;
  refreshing?: boolean;
  onRefresh?: () => void;
  updatedLabel?: string;
}) {
  const { tickers, quotes, refreshing, onRefresh, updatedLabel } = props;

  if (!tickers?.length) return null;

  return (
    <section
      style={{
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(2, 6, 23, 0.35)",
        borderRadius: 16,
        padding: "10px 12px",
        color: "rgba(255,255,255,0.92)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Watchlist Tape {updatedLabel ? <span style={{ fontWeight: 700, opacity: 0.7 }}>• {updatedLabel}</span> : null}
        </div>

        {onRefresh ? (
          <button
            onClick={onRefresh}
            disabled={!!refreshing}
            style={{
              fontSize: 12,
              fontWeight: 900,
              borderRadius: 12,
              padding: "6px 10px",
              border: "1px solid rgba(148,163,184,0.30)",
              background: "rgba(15, 23, 42, 0.35)",
              color: "rgba(255,255,255,0.92)",
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 6,
          scrollBehavior: "smooth",
        }}
      >
        {tickers.map((t) => {
          const q = quotes?.[t];
          const pct = q?.change_pct;
          const isUp = typeof pct === "number" ? pct >= 0 : null;

          return (
            <a
              key={t}
              href={`/app/dashboard/${t}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 210,
                borderRadius: 14,
                padding: "10px 12px",
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(2, 6, 23, 0.25)",
                textDecoration: "none",
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 14 }}>{t}</div>

              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>
                  {q ? `$${Number(q.price).toFixed(2)}` : "—"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>
                  {typeof pct === "number" ? (
                    <span style={{ color: isUp ? "#22c55e" : "#ef4444" }}>{fmtPct(Number(pct))}</span>
                  ) : (
                    <span style={{ opacity: 0.6 }}>loading…</span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
