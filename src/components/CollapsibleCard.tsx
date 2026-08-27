"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A standard card that can be minimised, remembering its state per person.
 *
 * The open/closed choice is kept in localStorage so a long page like Settings
 * stays how you left it. It's read after mount rather than during render, so
 * the server and browser markup always agree.
 */
export default function CollapsibleCard({
  id,
  title,
  sub,
  defaultOpen = true,
  children,
}: {
  /** Stable key for remembering this card's state. */
  id: string;
  title: string;
  sub?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`adex-card-${id}`);
      if (stored === "closed") setOpen(false);
      else if (stored === "open") setOpen(true);
    } catch {
      /* private windows and blocked storage are fine — just use the default */
    }
  }, [id]);

  function toggle() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      try {
        localStorage.setItem(`adex-card-${id}`, next ? "open" : "closed");
      } catch {
        /* not being able to remember is not worth failing over */
      }
      return next;
    });
  }

  return (
    <section className={open ? "card" : "card is-collapsed"}>
      <div className="card-head">
        <h2>{title}</h2>
        {sub && <span className="sub">{sub}</span>}
        <button
          type="button"
          className="card-toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? `Minimise ${title}` : `Expand ${title}`}
          title={open ? "Minimise" : "Expand"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
          </svg>
        </button>
      </div>
      {open && children}
    </section>
  );
}
