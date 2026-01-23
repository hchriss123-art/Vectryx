"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { BRAND } from "@/lib/brand";

export default function Navbar() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isAuthed, setIsAuthed] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  // auth state
  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!supabase) return;

      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (!mounted) return;

      setIsAuthed(!!user);
      setEmail(user?.email ?? "");
    };

    boot();

    if (!supabase)
      return () => {
        mounted = false;
      };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setIsAuthed(!!user);
      setEmail(user?.email ?? "");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // close menu when switching to desktop width
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <nav className="vx-nav">
      <div className="vx-nav-inner">
        {/* Brand */}
        <div className="vx-brand">
          <Link href="/" aria-label={`${BRAND.name} Home`} style={{ display: "flex", alignItems: "center" }}>
            {/* IMPORTANT: don't render Image if src is missing */}
            {BRAND.navLogoSrc ? (
              <Image
                src={BRAND.navLogoSrc}
                alt={BRAND.name}
                width={BRAND.navLogoW}
                height={BRAND.navLogoH}
                style={{ height: BRAND.navLogoH, width: "auto", display: "block" }}
                priority
                unoptimized
              />
            ) : (
              <span style={{ fontWeight: 900, fontSize: 18 }}>{BRAND.name}</span>
            )}
          </Link>
        </div>

        {/* Desktop links */}
        <div className="vx-links">
          <NavLink href="/pricing" label="Pricing" />
          <NavLink href="/philosophy" label="Philosophy" />
          {isAuthed && <NavLink href="/preferences" label="Preferences" />}
          {isAuthed && <NavLink href="/app/dashboard" label="Dashboard" />}
          {isAuthed && <NavLink href="/app/dashboard/watchlist" label="Watchlist" />}
          {!isAuthed && <NavLink href="/login" label="Login" />}
        </div>

        {/* Desktop auth */}
        <div className="vx-auth">
          {isAuthed ? (
            <>
              {email ? <div className="vx-email">{email}</div> : null}
              <Link className="vx-btn" href="/logout">
                Logout
              </Link>
            </>
          ) : (
            <>
              <Link className="vx-btn" href="/signup" style={{ background: "white", color: "#0f172a" }}>
                Start Free
              </Link>
              <Link className="vx-btn" href="/login">
                Login
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="vx-mobile-btn" aria-label="Open menu" onClick={() => setMenuOpen((v) => !v)}>
          ☰
        </button>
      </div>

      {/* Mobile menu */}
      <div className="vx-mobile-menu" style={{ display: menuOpen ? "block" : "none" }}>
        <Link href="/pricing" onClick={() => setMenuOpen(false)}>
          Pricing
        </Link>
        <Link href="/philosophy" onClick={() => setMenuOpen(false)}>
          Philosophy
        </Link>

        {isAuthed ? (
          <>
            <Link href="/preferences" onClick={() => setMenuOpen(false)}>
              Preferences
            </Link>
            <Link href="/app/dashboard" onClick={() => setMenuOpen(false)}>
              Dashboard
            </Link>
            <Link href="/app/dashboard/watchlist" onClick={() => setMenuOpen(false)}>
              Watchlist
            </Link>
            <Link href="/logout" onClick={() => setMenuOpen(false)}>
              Logout
            </Link>
            {email ? (
              <div className="vx-email" style={{ padding: "10px" }}>
                {email}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Link href="/signup" onClick={() => setMenuOpen(false)}>
              Start Free
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="vx-link" href={href}>
      {label}
    </Link>
  );
}
