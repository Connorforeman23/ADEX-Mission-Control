"use client";

import { useMemo } from "react";
import Drawer from "@/components/Drawer";
import type { TimelineEntry } from "@/lib/organisations";

/**
 * Reading an email properly, without leaving the CRM.
 *
 * Opening one message opens its whole conversation, oldest first, the way a
 * mail client shows a thread — because a single message out of context rarely
 * answers the question you opened it to answer.
 *
 * The real thing is always one click away in Outlook: this is for reading, not
 * replying.
 */
function when(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailThread({
  open,
  entries,
  onClose,
}: {
  /** The message that was clicked, or null when nothing is open. */
  open: TimelineEntry | null;
  /** The whole timeline — the thread is picked out of it. */
  entries: TimelineEntry[];
  onClose: () => void;
}) {
  // Every message in the same conversation, oldest first. A message with no
  // conversation id is a thread of one.
  const thread = useMemo(() => {
    if (!open?.email) return [];
    const id = open.email.conversationId;
    const inThread = id
      ? entries.filter((e) => e.kind === "Email" && e.email?.conversationId === id)
      : [open];
    return [...inThread].sort((a, b) => a.at.localeCompare(b.at));
  }, [open, entries]);

  return (
    <Drawer
      open={!!open}
      eyebrow={
        thread.length > 1 ? `Conversation · ${thread.length} messages` : "Email"
      }
      title={open?.summary ?? ""}
      onClose={onClose}
    >
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {thread.map((m) => {
            const d = m.email;
            const out = d?.direction === "out";
            return (
              <article
                key={m.id}
                className="card"
                style={{
                  padding: "14px 16px",
                  // Ours on one side, theirs on the other — the shape of the
                  // conversation is readable before a word is.
                  borderLeft: `3px solid ${out ? "var(--blue)" : "var(--c-radio)"}`,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="strong">{d?.from ?? m.who}</span>
                  <span className="pill">{out ? "Sent" : "Received"}</span>
                  <span className="num sub-line" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {when(m.at)}
                  </span>
                </div>

                {(d?.to.length || d?.cc.length) && (
                  <div className="sub-line" style={{ marginTop: 4 }}>
                    {d?.to.length ? `To: ${d.to.join(", ")}` : ""}
                    {d?.cc.length ? `${d.to.length ? " · " : ""}cc: ${d.cc.join(", ")}` : ""}
                  </div>
                )}

                {m.summary !== open.summary && (
                  <div className="strong" style={{ marginTop: 8 }}>
                    {m.summary}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    lineHeight: 1.6,
                    // The body is plain text taken out of the original HTML,
                    // so its own line breaks are all the formatting there is.
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 420,
                    overflowY: "auto",
                  }}
                >
                  {d?.body || m.detail || "(no content stored for this message)"}
                </div>

                {m.href && (
                  <div style={{ marginTop: 10 }}>
                    <a
                      className="btn"
                      href={m.href}
                      target="_blank"
                      rel="noreferrer"
                      title="Opens the real message in your own Outlook"
                    >
                      Open in Outlook ↗
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
