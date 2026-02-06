"use client";

import React, { useEffect, useMemo, useState } from "react";

type HeroDirection = "bullish" | "bearish" | "neutral";

export type HeroSignal = {
  ticker: string;
  direction?: HeroDirection;
  confidence?: number; // 0-100
  headline?: string;
  thesis?: string;
  catalysts?: string[];
  source?: string;
  updatedAt?: string | null;
  price?: number | null;
  changePct?: number | null;
};

type Props = {
  signal?: HeroSignal | null;
  loading?: boolean;
  emptyMessage?: string;
  showMeta?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPrice(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatTime(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HeroSignalCard({
  signal,
  loading = false,
  emptyMessage = "No high-confidence signals yet — monitoring your watchlist.",
  showMeta = true,
}: Props) {
  const flashKey = signal?.updatedAt || "";
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flashKey) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 650);
    return () => clearTimeout(t);
  }, [flashKey]);

  const direction: HeroDirection = signal?.direction ?? "neutral";
  const confidence = clamp(Math.round(signal?.confidence ?? 0), 0, 100);

  const accent = useMemo(() => {
    if (direction === "bullish") return { border: "rgba(34,197,94,0.30)", text: "#bbf7d0" };
    if (direction === "bearish") return { border: "rgba(239,68,68,0.30)", text: "#fecaca" };
    return { border: "rgba(148,163,184,0.28)", text: "rgba(255,255,255,0.88)" };
  }, [direction]);

  const hasSignal = !!signal?.ticker;

  const headline =
    signal?.headline?.trim() ||
    (direction === "bullish" ? "Bullish Signal" : direction === "bearish" ? "Bearish Signal" : "Market Signal");

  const thesis = signal?.thesis?.trim() || "";

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 18,
        border: `1px solid ${accent.border}`,
        background: flash ? "rgba(34,197,94,0.06)" : "rgba(2, 6, 23, 0.35)",
        color: "rgba(255,255,255,0.92)",
        boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Highest Confidence
            </span>

            {showMeta ? (
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                {(signal?.source || "Morpheus AI") + (signal?.updatedAt ? ` • Updated ${formatTime(signal.updatedAt)}` : "")}
              </span>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 32, fontWeight: 950, letterSpacing: -0.6 }}>
                {loading ? "Loading…" : hasSignal ? signal!.ticker.toUpperCase() : "—"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: accent.text }}>{loading ? "" : headline}</div>
            </div>

            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85, lineHeight: 1.5, maxWidth: 820 }}>
              {loading ? "Loading signal…" : hasSignal && thesis ? thesis : emptyMessage}
            </div>

            {!loading && hasSignal && signal?.catalysts?.length ? (
              <ul style={{ marginTop: 10, paddingLeft: 18, opacity: 0.85 }}>
                {signal.catalysts.slice(0, 3).map((c, idx) => (
                  <li key={`${idx}-${c}`} style={{ marginTop: 6, fontSize: 13 }}>
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div style={{ width: 320, maxWidth: "100%" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {typeof signal?.price === "number" ? (
              <div style={{ fontSize: 14, fontWeight: 900 }}>{formatPrice(signal.price)}</div>
            ) : null}

            {typeof signal?.changePct === "number" ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 950,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background:
                    signal.changePct > 0
                      ? "rgba(34,197,94,0.12)"
                      : signal.changePct < 0
                        ? "rgba(239,68,68,0.12)"
                        : "rgba(255,255,255,0.06)",
                  color: signal.changePct > 0 ? "#bbf7d0" : signal.changePct < 0 ? "#fecaca" : "rgba(255,255,255,0.8)",
                }}
              >
                {formatPct(signal.changePct)}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.75 }}>
              <span style={{ fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>Confidence</span>
              <span style={{ fontWeight: 950 }}>{loading ? "—" : `${confidence}%`}</span>
            </div>

            <div
              style={{
                marginTop: 8,
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: loading ? "30%" : `${confidence}%`,
                  background: direction === "bearish" ? "rgba(239,68,68,0.65)" : direction === "bullish" ? "rgba(34,197,94,0.65)" : "rgba(56,189,248,0.55)",
                  transition: "width 450ms ease",
                }}
              />
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65, display: "flex", justifyContent: "space-between" }}>
              <span>
                Bias: {direction === "bullish" ? "Bullish" : direction === "bearish" ? "Bearish" : "Neutral"}
              </span>
              <span style={{ color: accent.text }}>
                {typeof signal?.changePct === "number"
                  ? signal.changePct > 0
                    ? "Momentum: Rising"
                    : signal.changePct < 0
                      ? "Momentum: Falling"
                      : "Momentum: Flat"
                  : "Momentum: —"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
