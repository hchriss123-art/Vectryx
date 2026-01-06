"use client";

type Confidence = "Very Strong" | "Strong" | "Moderate" | "Weak";

type HeroSignal =
  | {
      state: "active";
      companyName: string;
      ticker: string;
      signalType: string;
      confidence: Confidence;
      detectedAgo: string;
      recentActivity?: string;
      whyThisMatters?: string;
      href: string;
    }
  | {
      state: "empty";
      lastEvaluationAgo: string;
    }
  | {
      state: "loading";
    };

export function HeroSignalCard({ data }: { data: HeroSignal }) {
  return (
    <section
      className="vx-mobile-card"
      style={{
        border: "1px solid rgba(148,163,184,0.25)",
        borderRadius: 16,
        background: "rgba(2, 6, 23, 0.35)",
        padding: 18,
      }}
    >

      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
        {data.state === "loading"
          ? "Evaluating market activity…"
          : "Highest-Confidence Signal"}
      </div>

      {data.state === "active" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            {data.companyName}{" "}
            <span style={{ opacity: 0.6 }}>({data.ticker})</span>
          </div>

          <div style={{ marginTop: 6, fontSize: 15, opacity: 0.9 }}>
            {data.signalType}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
            <div>
              Confidence: <strong>{data.confidence}</strong>
            </div>
            <div>Detected {data.detectedAgo}</div>
            {data.recentActivity && (
              <div>Recent activity: {data.recentActivity}</div>
            )}
          </div>

          {data.whyThisMatters && (
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
              <strong>Why this matters:</strong> {data.whyThisMatters}
            </div>
          )}

          <a
          href={data.href}
          className="vx-soft-link"
            style={{
            display: "inline-block",
            marginTop: 14,
            padding: "8px 0",
            textDecoration: "none",
        }}
     >
    View Signal →
      </a>

        </div>
      )}

      {data.state === "empty" && (
        <div style={{ marginTop: 12 }}>
          <div className="vx-nowrap-ellipsis" style={{ fontSize: 26, fontWeight: 900 }}>
            No High-Confidence Signals Right Now
          </div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
            Morpheus is actively evaluating your watchlist.
            <br />
            Signals surface only when conviction thresholds are met.
          </div>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
            Last evaluation: {data.lastEvaluationAgo}
          </div>
        </div>
      )}

      {data.state === "loading" && (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.75 }}>
          Updating the highest-conviction signal.
        </div>
      )}
    </section>
  );
}
