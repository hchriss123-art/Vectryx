"use client";

type Confidence = "Very Strong" | "Strong" | "Moderate" | "Weak";

function signalCategory(label: string) {
  const s = label.toLowerCase();
  if (s.includes("form 4") || s.includes("insider")) return "Insider";
  if (s.includes("news")) return "News";
  if (s.includes("move") || s.includes("price") || s.includes("volume")) return "Market";
  if (s.includes("test")) return "Test";
  return "Other";
}

type SignalCard = {
  companyName: string;
  ticker: string;
  signalType: string;
  confidence: Confidence;
  detectedAgo: string;
  whyThisMatters?: string;
  href: string;
};

export function RecentSignals({ items }: { items: SignalCard[] }) {
  const linkWhite: React.CSSProperties = {
    color: "rgba(255,255,255,0.92)",
    textDecoration: "none",
  };

  return (
    <section
      className="vx-mobile-card"
      style={{
        marginTop: 14,
        borderRadius: 16,
        padding: 18,
        background: "rgba(2, 6, 23, 0.35)",
        border: "1px solid rgba(148,163,184,0.25)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Recent Signals</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Ranked by confidence and relevance
          </div>
        </div>

        <a
          href="/signals"
          style={{
            ...linkWhite,
            fontSize: 13,
            fontWeight: 900,
            border: "1px solid rgba(148,163,184,0.35)",
            borderRadius: 12,
            padding: "8px 12px",
          }}
        >
          View all →
        </a>
      </div>

      {items.length === 0 ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>No Recent Signals</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Market conditions did not meet confidence requirements during this period.
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {items.slice(0, 5).map((s) => (
            <a
              key={`${s.ticker}-${s.detectedAgo}`}
              href={s.href}
              style={{
                ...linkWhite,
                display: "block",
                borderRadius: 14,
                padding: 14,
                background: "rgba(2, 6, 23, 0.25)",
                border: "1px solid rgba(148,163,184,0.20)",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900 }}>
                {s.companyName} <span style={{ opacity: 0.6 }}>({s.ticker})</span>
              </div>

              <div style={{ marginTop: 6 }}>
  <span
    style={{
      fontSize: 11,
      fontWeight: 900,
      padding: "3px 7px",
      borderRadius: 999,
      border: "1px solid rgba(148,163,184,0.35)",
      background: "rgba(148,163,184,0.12)",
      marginRight: 6,
    }}
  >
    {signalCategory(s.signalType)}
  </span>

  <span style={{ fontSize: 13, opacity: 0.9 }}>
    {s.signalType}
  </span>
</div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                <div>
                  Confidence: <strong>{s.confidence}</strong>
                </div>
                <div>Detected {s.detectedAgo}</div>
              </div>

              {s.whyThisMatters && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                  <strong>Why this matters:</strong> {s.whyThisMatters}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                View details →
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
