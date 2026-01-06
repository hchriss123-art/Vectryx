import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PhilosophyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "white" }}>
      <Navbar />

      <section style={{ background: "linear-gradient(135deg, #0f172a, #020617)", borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 18px 22px" }}>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", margin: 0, fontWeight: 950, letterSpacing: -0.8 }}>
            Vectryx Philosophy
          </h1>
          <p style={{ fontSize: "clamp(14px, 3.6vw, 18px)", lineHeight: 1.6, opacity: 0.92, marginTop: 14, maxWidth: 860 }}>
            We protect attention before capital is deployed — by surfacing only the signals that clear conviction thresholds,
            aligned to your watchlist and rules.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <Link
              href="/pricing"
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
              View Pricing
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

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "22px 18px 44px" }}>
        <Card title="1) Attention is a scarce asset">
          Vectryx is not a firehose. It is a filter. We reduce noise and protect your focus so decisions happen with clarity.
        </Card>

        <Card title="2) Conviction criteria">
          Conviction criteria are the rules Vectryx uses to decide when a signal is strong enough to be worth your attention.
        </Card>

        <Card title="3) Preference-first intelligence">
          Your watchlist, thresholds, and channels define what matters. Vectryx adapts to you — not the other way around.
        </Card>

        <Card title="4) Trust through transparency">
          We explain “why this matters” so you understand the signal, the context, and the reason it was surfaced.
        </Card>

        <div style={{ marginTop: 18, opacity: 0.82, fontSize: 14, lineHeight: 1.6 }}>
          Want to discuss investor access, demos, or partnerships? Use the dashboard and keep the conversation focused on conviction.
        </div>
      </section>
    </main>
  );
}

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
      <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
