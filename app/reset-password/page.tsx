"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = async () => {
    setStatus(null);

    if (!supabase) {
      setStatus("Supabase is not configured. Check environment variables.");
      return;
    }

    if (password.trim().length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password: password.trim() });

    if (error) {
      setStatus(error.message);
      setSaving(false);
      return;
    }

    setStatus("Password updated ✅ You can now log in.");
    setSaving(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "white", padding: 24 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, fontWeight: 950, margin: "10px 0 8px" }}>Choose a new password</h1>
        <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
          Enter a new password. This page is opened from your reset email.
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>New password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            type="password"
            style={input}
          />
        </div>

        {status ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
            {status}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <button onClick={update} disabled={saving} style={btn}>
            {saving ? "Saving…" : "Update password"}
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