"use client";

import { useEffect } from "react";

/** Slide-over panel used for booking and editing campaigns. */
export default function Drawer({
  open,
  title,
  eyebrow,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer${open ? " on" : ""}`} aria-hidden={!open}>
        <header>
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <button className="btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="drawer-body">{open && children}</div>
      </aside>

      <style jsx>{`
        .scrim {
          position: fixed;
          inset: 0;
          background: rgba(5, 8, 18, 0.55);
          backdrop-filter: blur(3px);
          z-index: 70;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s;
        }
        .scrim.on {
          opacity: 1;
          pointer-events: auto;
        }
        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: min(760px, 96vw);
          z-index: 80;
          background: var(--bg);
          border-left: 1px solid var(--line);
          box-shadow: var(--shadow-pop);
          transform: translateX(102%);
          transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
          display: flex;
          flex-direction: column;
        }
        .drawer.on {
          transform: none;
        }
        header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--line);
          background: var(--surface);
        }
        header h2 {
          margin: 3px 0 0;
          font-size: 18px;
          font-weight: 660;
          letter-spacing: -0.02em;
        }
        header :global(.btn) {
          margin-left: auto;
        }
        .drawer-body {
          padding: 18px 20px 40px;
          overflow-y: auto;
          flex: 1;
        }
      `}</style>
    </>
  );
}
