"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { href: "/campaigns?new=1", label: "Campaign", hint: "Book media with charges and POs" },
  { href: "/pipeline?new=1", label: "Opportunity", hint: "New business conversation" },
  { href: "/creative?new=1", label: "Creative brief", hint: "Studio work for the board" },
  { href: "/tasks?new=1", label: "Task / reminder", hint: "Follow-up with a date and owner" },
];

/** The dashboard's "+ New" menu — one place to add anything. */
export default function QuickNew() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-primary" onClick={() => setOpen(!open)} aria-expanded={open}>
        + New
        <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: "currentColor", fill: "none", strokeWidth: 2 }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.href}
              className="menu-item"
              onClick={() => {
                setOpen(false);
                router.push(o.href);
              }}
            >
              <span className="strong">{o.label}</span>
              <small>{o.hint}</small>
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          z-index: 50;
          width: 250px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: var(--shadow-pop);
          padding: 5px;
        }
        .menu-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 9px 11px;
          border-radius: 8px;
        }
        .menu-item:hover {
          background: var(--blue-wash);
        }
        .menu-item small {
          display: block;
          color: var(--faint);
          font-size: 11.5px;
        }
      `}</style>
    </div>
  );
}
