import Navbar from "@/components/Navbar";

export default function MorpheusPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontSize: 40, marginBottom: 10 }}>Morpheus</h1>
        <p style={{ color: "#475569", lineHeight: 1.6, maxWidth: 800 }}>
          Morpheus monitors insider activity (Form 4), dedupes signals, and delivers alerts and digests based on your preferences.
        </p>
      </div>
    </main>
  );
}
