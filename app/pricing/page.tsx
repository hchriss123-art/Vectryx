import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PricingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "white" }}>
      <Navbar />

      <section style={{ background: "linear-gradient(135deg, #0f172a, #020617)", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 18px 22px" }}>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", margin: 0, fontWeight: 950, letterSpacing: -0.8 }}>
            Pricing
          </h1>
          <p style={{ fontSize: "clamp(14px, 3.6vw, 18px)", lineHeight: 1.6, opacity: 0.92, marginTop: 14, maxWidth: 860 }}>
            Keep it simple. Pay for capacity when you need it. Upgrade when conviction becomes a habit.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <Link
              href="/signup"
              style={{
                background: "white",
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 900,
                padding: "12px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              Start Free
            </Link>

            <Link
              href="/app/dashboard"
              style={{
                background: "transparent",
                color: "white",
                textDecoration: "none",
                fontWeight: 900,
                padding: "12px 16px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.28)",
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 18px 44px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <Tier
            title="FREE"
            price="$0"
            bullets={[
              "5 tickers",
              "Signal feed (demo-ready)",
              "Preferences + watchlist",
              "Email/Push/SMS toggles",
            ]}
            ctaLabel="Start Free"
            ctaHref="/signup"
          />

          <Tier
            title="PRO"
            price="$19/mo"
            bullets={[
              "15 tickers",
              "Higher scan frequency",
              "Stronger scoring + filtering",
              "Priority support",
            ]}
            ctaLabel="Upgrade to Pro"
            ctaHref="/pricing"
            highlight
          />

          <Tier
            title="VECTRYX"
            price="Approval"
            bullets={[
              "50 tickers base",
              "Advanced conviction rules",
              "Insider monitoring modules",
              "Investor snapshot mode",
            ]}
            ctaLabel="Request Access"
            ctaHref="/app/dashboard"
          />
        </div>

        <div
          className="vx-mobile-card"
          style={{
            marginTop: 16,
            border: "1px solid rgba(148,163,184,0.20)",
            background: "rgba(2, 6, 23, 0.35)",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 16 }}>Capacity Add-On</div>
          <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.7 }}>
            Add <strong>+10 tickers</strong> for <strong>$5</strong>. Stack as needed. This makes each tier virtually unlimited while staying fair.
          </div>
        </div>
      </section>
    </main>
  );
}

function Tier({
  title,
  price,
  bullets,
  ctaLabel,
  ctaHref,
  highlight,
}: {
  title: string;
  price: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="vx-mobile-card"
      style={{
        border: `1px solid ${highlight ? "rgba(56,189,248,0.35)" : "rgba(148,163,184,0.20)"}`,
        background: highlight ? "rgba(56,189,248,0.08)" : "rgba(2, 6, 23, 0.35)",
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.8 }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 950, marginTop: 8 }}>{price}</div>

      <ul style={{ marginTop: 10, paddingLeft: 18, opacity: 0.9, lineHeight: 1.7 }}>
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        style={{
          display: "inline-block",
          marginTop: 14,
          padding: "12px 16px",
          borderRadius: 14,
          background: "white",
          color: "#0f172a",
          textDecoration: "none",
          fontWeight: 950,
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
