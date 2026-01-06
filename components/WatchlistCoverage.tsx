"use client";

import Link from "next/link";

export function WatchlistCoverage(props: {
  monitoredCount: number;
  capacity: number;
  planLabel: string;
  lastEvaluationAgo: string;
  hrefManage: string;
}) {
  const pct = props.capacity ? Math.min(100, Math.round((props.monitoredCount / props.capacity) * 100)) : 0;

  return (
    <section
      className="vx-mobile-card"
      style={{
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 18,
        background: "rgba(2, 6, 23, 0.35)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        padding: 18,
        marginTop: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>Watchlist Coverage</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.70)" }}>
            {props.monitoredCount} equities actively monitored
            <span style={{ margin: "0 8px", opacity: 0.35 }}>•</span>
            Last evaluation: {props.lastEvaluationAgo}
          </div>
        </div>

        <Link
          href={props.hrefManage}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.28)",
            color: "rgba(255,255,255,0.92)",
            textDecoration: "none",
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          Manage <span style={{ opacity: 0.8 }}>→</span>
        </Link>
      </div>

      <div style={{ marginTop: 14, color: "rgba(255,255,255,0.82)", fontSize: 14 }}>
        Current plan capacity:{" "}
        <strong style={{ color: "rgba(255,255,255,0.95)" }}>
          {props.capacity}
        </strong>{" "}
        <span style={{ opacity: 0.75 }}>(Plan: {props.planLabel})</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.12)" }}>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              width: `${pct}%`,
              background: "rgba(255,255,255,0.55)",
            }}
          />
        </div>

        <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.70)" }}>
          Allocation:{" "}
          <strong style={{ color: "rgba(255,255,255,0.90)" }}>
            {props.monitoredCount}/{props.capacity || "—"}
          </strong>{" "}
          <span style={{ marginLeft: 8, opacity: 0.7 }}>({pct}% used)</span>
        </div>
      </div>
    </section>
  );
}
