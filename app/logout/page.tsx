"use client";

import { useEffect, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LogoutPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    const run = async () => {
      if (!supabase) {
        window.location.href = "/";
        return;
      }

      await supabase.auth.signOut();
      window.location.href = "/";
    };

    run();
  }, [supabase]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 40 }}>
      Signing out...
    </div>
  );
}
