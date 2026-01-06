"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseBrowser";

export default function LogoutPage() {
  useEffect(() => {
    const run = async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    };
    run();
  }, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 40 }}>
      Signing out...
    </div>
  );
}
