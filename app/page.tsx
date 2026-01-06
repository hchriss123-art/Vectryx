import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "white" }}>
      <Navbar />

      <section style={{ background: "linear-gradient(135deg, #0f172a, #020617)", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 18px 34px" }}>
          <h1
            style={{
              fontSize: "clamp(34px, 6.2vw, 64px)",
              lineHeight: 1.04,
              margin: 0,
              fontWeight: 950,
              letterSpacing: -0.8,
            }}
          >
            Vectryx
          </h1>

          <p
            style={{
              fontSize: "clamp(14px, 3.6vw, 18px)",
              maxWidth: 760,
              lineHeight: 1.6,
              opacity: 0.92,
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            High-conviction market intelligence built for decision-makers.
            <br />
            Focus on what matters — and act when conviction is highest.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{
                background: "white",
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 950,
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
              }}
            >
              Start Free
            </Link>

            <Link
              href="/pricing"
              style={{
                background: "transparent",
                color: "white",
                textDecoration: "none",
                fontWeight: 950,
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.28)",
              }}
            >
              View Pricing
            </Link>

            <Link
              href="/app/dashboard"
              style={{
                background: "transparent",
                color: "white",
                textDecoration: "none",
                fontWeight: 950,
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.28)",
              }}
            >
              Dashboard
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
              marginTop: 30,
              paddingBottom: 8,
            }}
          >
            <Card title="Preference-first">
              Tell Vectryx what matters. It monitors your watchlist and thresholds in the background.
            </Card>

            <Card title="Dedupe built-in">
              No repeated alerts. Clean signal only — built to protect attention.
            </Card>

            <Card title="Conviction-driven">
              Vectryx surfaces signals only when conviction thresholds are met.
            </Card>
          </div>

          <div style={{ marginTop: 18, opacity: 0.85 }}>
            Read the <Link href="/philosophy" style={{ color: "rgba(56,189,248,0.95)", fontWeight: 950, textDecoration: "none" }}>Vectryx Philosophy</Link>.
          </div>
        </div>
      </section>

      <div style={{ height: 36 }} />
    </main>
  );
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div
      className="vx-mobile-card"
      style={{
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 18,
        background: "rgba(2, 6, 23, 0.35)",
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
