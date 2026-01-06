import Navbar from "@/components/Navbar";

export default function StockJockeyPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontSize: 40, marginBottom: 10 }}>Stock Jockey</h1>
        <p style={{ color: "#475569", lineHeight: 1.6, maxWidth: 800 }}>
          Stock Jockey powers watchlists, alerts, scoring, and opportunity ranking—tuned to your strategy and risk tolerance.
        </p>
      </div>
    </main>
  );
}
