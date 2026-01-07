"use client";

import Navbar from "@/components/Navbar";
import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function SignupPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const signup = async () => {
    if (!supabase) {
      setStatus("Supabase is not configured. Check environment variables.");
      return;
    }

    setStatus("Creating account...");
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Account created! Redirecting to login...");
    window.location.href = "/login";
  };

  return (
    <main style={{ fontFamily: "Arial, sans-serif" }}>
      <Navbar />

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <h1 style={{ fontSize: 36, marginBottom: 10 }}>Create Account</h1>

        <p style={{ color: "#475569", marginBottom: 22 }}>
          Sign up for Morpheus + Stock Jockey.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
            }}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
            }}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={signup}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: "black",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Create account
          </button>

          {status && (
            <div style={{ fontSize: 14, color: "#334155" }}>{status}</div>
          )}
        </div>
      </div>
    </main>
  );
}
