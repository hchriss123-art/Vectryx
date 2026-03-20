"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setStatus(null);

    if (!supabase) {
      setStatus("Supabase is not configured. Check environment variables.");
      return;
    }

    const e = email.trim();
    if (!e) {
      setStatus("Please enter your email.");
      return;
    }

    setSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatus(error.message);
      setSending(false);
      return;
    }

    setStatus("Check your email for a reset link ✅");
    setSending(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "white", padding: 24 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, fontWeight: 950, margin: "10px 0 8px" }}>Reset password</h1>
        <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
          Enter your email and we’ll send you a password reset link.
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={input}
          />
        </div>

        {status ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
            {status}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <button onClick={send} disabled={sending} style={btn}>
            {sending ? "Sending…" : "Send reset link"}
          </button>

          <Link href="/login" style={{ ...btn, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}>
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
  fontWeight: 800,
};

const btn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "white",
  color: "#0f172a",
  fontWeight: 950,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};