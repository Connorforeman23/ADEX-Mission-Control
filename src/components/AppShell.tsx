"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { initials } from "@/lib/money";

const NAV = [
  {
    group: "Operate",
    items: [
      { href: "/", label: "Dashboard", icon: "M3 12h4l3 8 4-16 3 8h4" },
      { href: "/campaigns", label: "Campaigns", icon: "M3 5h18v14H3zM3 10h18M9 10v9" },
      { href: "/media-plan", label: "Media plan", icon: "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4" },
      { href: "/creative", label: "Creative", icon: "M12 3 4 8v8l8 5 8-5V8zM12 12v9M4 8l8 4 8-4" },
      { href: "/tasks", label: "Tasks", icon: "M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" },
    ],
  },
  {
    group: "Grow",
    items: [
      { href: "/clients", label: "Clients", icon: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a6 6 0 0 1 12 0M18 20a5.5 5.5 0 0 0-3-4.9" },
      { href: "/contacts", label: "Contacts", icon: "M16 4h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a6 6 0 0 1 12 0M3 8h4M3 12h4" },
      { href: "/pipeline", label: "Pipeline", icon: "M4 5h16M6 12h12M9 19h6" },
    ],
  },
  {
    group: "Measure",
    restricted: false, // hidden entirely for restricted users
    items: [
      { href: "/finance", label: "Finance", icon: "M4 19V9M10 19V5M16 19v-7M22 19H2" },
      { href: "/reports", label: "Reports", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8ZM14 3v5h5M9 13h6M9 17h4" },
      { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.6a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.7-2.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" },
    ],
  },
];

export default function AppShell({
  fullName,
  role,
  children,
}: {
  fullName: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Sidebar mode, remembered between visits: full, icon-only, or hidden.
  const [railMode, setRailMode] = useState<"full" | "mini" | "hidden">(() => {
    if (typeof window === "undefined") return "full";
    const stored = localStorage.getItem("adex-rail");
    return stored === "mini" || stored === "hidden" ? stored : "full";
  });
  function setRail(mode: "full" | "mini" | "hidden") {
    setRailMode(mode);
    localStorage.setItem("adex-rail", mode);
  }

  // The inline script in the document head has already applied the saved
  // theme, so read the result rather than duplicating that logic here.
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return true;
    const stamped = document.documentElement.getAttribute("data-theme");
    if (stamped) return stamped === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("adex-theme", next);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={`shell rail-${railMode}`}>
      <aside className={`rail${menuOpen ? " open" : ""}`}>
        <div className="brand">
          <div className="mark">
            <span>AE</span>
          </div>
          <div className="wordmark">
            <b>ADEX CRM</b>
            <i>MISSION CONTROL</i>
          </div>
          <div className="rail-controls">
            <button
              className="rail-btn"
              title={railMode === "mini" ? "Expand sidebar" : "Minimise sidebar"}
              aria-label={railMode === "mini" ? "Expand sidebar" : "Minimise sidebar"}
              onClick={() => setRail(railMode === "mini" ? "full" : "mini")}
            >
              <svg viewBox="0 0 24 24">
                {railMode === "mini" ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
              </svg>
            </button>
            <button
              className="rail-btn"
              title="Hide sidebar"
              aria-label="Hide sidebar"
              onClick={() => setRail("hidden")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="nav">
          {NAV.filter((g) => role !== "restricted" || g.restricted !== false).map((group) => (
            <div key={group.group}>
              <div className="eyebrow nav-group">{group.group}</div>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? "nav-item on" : "nav-item"}
                    title={item.label}
                    onClick={() => setMenuOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="who">
            <span className="avatar">{initials(fullName)}</span>
            <div style={{ minWidth: 0 }}>
              <p>{fullName}</p>
              <small>{role === "admin" ? "Admin" : role === "restricted" ? "Own accounts" : "Standard"}</small>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={toggleTheme}>
              {dark ? "Light" : "Dark"}
            </button>
            <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={signOut}>
              Sign out
            </button>
          </div>
          <p className="strap">Creating marketing success stories since 1998.</p>
        </div>
      </aside>

      <main>
        <button className="menu-btn btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          ☰
        </button>
        {railMode === "hidden" && (
          <button
            className="rail-reveal btn"
            onClick={() => setRail("full")}
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            ☰
          </button>
        )}
        {children}
      </main>

      <style jsx>{`
        .shell {
          display: grid;
          grid-template-columns: 244px minmax(0, 1fr);
          min-height: 100vh;
          transition: grid-template-columns 0.18s ease;
        }
        .shell.rail-mini {
          grid-template-columns: 64px minmax(0, 1fr);
        }
        .shell.rail-hidden {
          grid-template-columns: 0 minmax(0, 1fr);
        }
        .shell.rail-hidden .rail {
          transform: translateX(-102%);
        }
        .rail-controls {
          margin-left: auto;
          display: flex;
          gap: 2px;
        }
        .rail-btn {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          color: var(--faint);
        }
        .rail-btn:hover {
          background: var(--surface-2);
          color: var(--text);
        }
        .rail-btn svg {
          width: 14px;
          height: 14px;
          stroke: currentColor;
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .rail-reveal {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 55;
        }
        /* Icon-only mode: the logo and wordmark go entirely — just the
           expand/hide controls remain — and labels become tooltips. */
        .shell.rail-mini .mark,
        .shell.rail-mini .wordmark,
        .shell.rail-mini .nav-group,
        .shell.rail-mini .rail-foot .who div,
        .shell.rail-mini .strap {
          display: none;
        }
        .shell.rail-mini .brand {
          padding: 14px 8px 8px;
          justify-content: center;
        }
        .shell.rail-mini .rail-controls {
          margin-left: 0;
        }
        .shell.rail-mini .nav :global(.nav-item) {
          justify-content: center;
          padding: 10px 0;
        }
        .shell.rail-mini .nav :global(.nav-item span) {
          display: none;
        }
        .shell.rail-mini .rail-foot {
          padding: 10px 6px;
        }
        .shell.rail-mini .rail-foot > div:last-of-type {
          flex-direction: column;
        }
        .rail {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--line);
          background: var(--surface);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 20px 18px 18px;
        }
        .mark {
          width: 34px;
          height: 34px;
          flex: none;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: linear-gradient(140deg, var(--blue) 0%, var(--pink) 100%);
          box-shadow: var(--glow-blue);
        }
        .mark span {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 15px;
          color: #fff;
        }
        .wordmark b {
          display: block;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.15;
        }
        .wordmark i {
          display: block;
          font-style: normal;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          background: linear-gradient(92deg, var(--blue), var(--pink));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .nav {
          flex: 1;
          overflow-y: auto;
          padding: 6px 10px;
        }
        .nav-group {
          padding: 14px 10px 6px;
        }
        .nav :global(.nav-item) {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 8px 10px;
          border-radius: 9px;
          color: var(--mid);
          font-size: 13.5px;
          font-weight: 500;
          position: relative;
          transition: background 0.13s, color 0.13s;
        }
        .nav :global(.nav-item svg) {
          width: 17px;
          height: 17px;
          flex: none;
          stroke: currentColor;
          stroke-width: 1.6;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .nav :global(.nav-item:hover) {
          background: var(--surface-2);
          color: var(--text);
        }
        .nav :global(.nav-item.on) {
          background: var(--blue-wash);
          color: var(--text);
        }
        .nav :global(.nav-item.on svg) {
          color: var(--blue);
        }
        .rail-foot {
          padding: 12px;
          border-top: 1px solid var(--line-soft);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .who {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }
        .avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          flex: none;
          display: grid;
          place-items: center;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(140deg, var(--blue-deep), var(--pink-deep));
        }
        .who p {
          margin: 0;
          font-size: 12.5px;
          font-weight: 550;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .who small {
          display: block;
          font-size: 11px;
          color: var(--faint);
        }
        .strap {
          margin: 0;
          font-size: 11px;
          color: var(--ghost);
          line-height: 1.35;
        }
        main {
          min-width: 0;
        }
        .menu-btn {
          display: none;
          margin: 12px;
        }
        @media (max-width: 1000px) {
          .shell {
            grid-template-columns: 1fr;
          }
          .rail {
            position: fixed;
            z-index: 60;
            width: 244px;
            transform: translateX(-102%);
            transition: transform 0.2s;
          }
          .rail.open {
            transform: none;
          }
          .menu-btn {
            display: inline-flex;
          }
        }
      `}</style>
    </div>
  );
}
