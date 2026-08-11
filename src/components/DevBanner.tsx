import { IS_PRODUCTION } from "@/lib/env";

// A persistent, unmissable marker on any non-production deployment, so a
// preview or local session can never be mistaken for the live application.
export default function DevBanner() {
  if (IS_PRODUCTION) return null;
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "repeating-linear-gradient(45deg, #b45309, #b45309 12px, #92400e 12px, #92400e 24px)",
        color: "#fff",
        textAlign: "center",
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        padding: "5px 12px",
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      DEV / TEST ENVIRONMENT — FICTIONAL DATA ONLY
    </div>
  );
}
