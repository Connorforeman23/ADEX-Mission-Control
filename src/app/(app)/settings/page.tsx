import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireFullAccess, getMyProfile, getApiKeys } from "@/lib/queries";
import { COMMISSION_RATE, MARGIN_FLOOR, VAT_RATE, initials } from "@/lib/money";
import { INVOICE_TOLERANCE } from "@/lib/po";
import { SUPPLIERS_BY_CHANNEL } from "@/lib/reference";
import TeamAdmin from "@/components/TeamAdmin";
import ActivityLog from "@/components/ActivityLog";
import XeroPanel from "@/components/XeroPanel";
import MicrosoftPanel from "@/components/MicrosoftPanel";
import CollapsibleCard from "@/components/CollapsibleCard";
import ApiKeys from "@/components/ApiKeys";

export const dynamic = "force-dynamic";

const COMMISSION_ROWS = [
  ["Digital", "15%"],
  ["TV", "15%"],
  ["Radio & DAB", "15%"],
  ["Out of Home", "15%"],
  ["Print", "15%"],
  ["Creative", "Time-based, billed at cost"],
];

export default async function SettingsPage() {
  await requireFullAccess();
  const profile = await getMyProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = await createClient();
  const { data: team } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_sales")
    .order("full_name");

  const members = team ?? [];
  // Only an admin can see keys at all, and RLS agrees — but there is no
  // point asking for them when the page will not show them.
  const apiKeys = isAdmin ? await getApiKeys() : [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>Settings</h1>
          <p>
            Team, commission defaults and integrations. Anyone on the staff list can create their own
            account at /signup — no invites needed.
          </p>
        </div>
      </div>

      <div className="cols">
        <CollapsibleCard id="team" title="Team" sub={`${members.length} signed up`}>
          <div className="card-body">
            {members.length === 0 ? (
              <p className="empty-note">Nobody has signed up yet.</p>
            ) : (
              <div className="rows">
                {members.map((m) => (
                  <div className="row" key={m.id}>
                    <span className="avatar-sm">{initials(m.full_name)}</span>
                    <div className="grow">
                      <p>{m.full_name}</p>
                      <small>{m.email}</small>
                    </div>
                    {m.is_sales && <span className="pill">Sales</span>}
                    <span className="pill">{m.role === "admin" ? "Admin" : "Standard"}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="sub-line" style={{ marginTop: 10 }}>
              Roles come from the staff list in the database. To add someone, add their email there
              first — sign-up is refused for anyone not on it.
            </p>
          </div>
        </CollapsibleCard>

        <CollapsibleCard id="commission" title="Commission defaults" sub="Supplier gross less…">
          <div className="card-body">
            <div className="rows">
              {COMMISSION_ROWS.map(([channel, rate]) => (
                <div className="row" key={channel}>
                  <div className="grow">
                    <p>{channel}</p>
                  </div>
                  <span className="num strong">{rate}</span>
                </div>
              ))}
            </div>
            <p className="sub-line" style={{ marginTop: 10 }}>
              Applied to every purchase order: supplier net = gross −{" "}
              {(COMMISSION_RATE * 100).toFixed(0)}%. VAT of {(VAT_RATE * 100).toFixed(0)}% is charged
              on the net.
            </p>
          </div>
        </CollapsibleCard>
      </div>

      {isAdmin && <TeamAdmin />}

      {/* Everyone connects their OWN mailbox and calendar — this is not an
          admin setting, and hiding it was why the team could not find it. */}
      <Suspense fallback={null}>
        <MicrosoftPanel />
      </Suspense>

      {/* Xero is one connection to one set of company books, so it stays
          admin-only. */}
      {isAdmin && (
        <Suspense fallback={null}>
          <XeroPanel />
        </Suspense>
      )}

      {/* Bulk history. Admin only, because a mistake here is a mistake
          across a year of bookings rather than one. */}
      {isAdmin && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="grow" style={{ minWidth: 220 }}>
              <p style={{ margin: 0, fontWeight: 560 }}>Import bookings</p>
              <small className="sub-line">
                Load a year of history from a spreadsheet. Nothing is written until you have
                seen what it will do.
              </small>
            </div>
            <Link className="btn" href="/import">
              Open
            </Link>
          </div>
        </section>
      )}

      {isAdmin && <ApiKeys keys={apiKeys} staff={members} />}

      {isAdmin && <ActivityLog />}

      <div className="cols">
        <CollapsibleCard id="rules" title="Rules" sub="Applied across the app">
          <div className="card-body">
            <div className="rows">
              <div className="row">
                <div className="grow">
                  <p>Margin floor</p>
                  <small>Campaigns below this are flagged on the dashboard and lists</small>
                </div>
                <span className="num strong">{MARGIN_FLOOR}%</span>
              </div>
              <div className="row">
                <div className="grow">
                  <p>Invoice matching tolerance</p>
                  <small>Supplier invoices within this of the PO net match automatically</small>
                </div>
                <span className="num strong">£{INVOICE_TOLERANCE}</span>
              </div>
              <div className="row">
                <div className="grow">
                  <p>Client invoicing</p>
                  <small>Client gross is held ex VAT; VAT is added at invoicing</small>
                </div>
                <span className="num strong">{(VAT_RATE * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </CollapsibleCard>

      </div>

      <CollapsibleCard
        id="rosters"
        title="Supplier rosters"
        sub="Offered in the booking form, per channel"
      >
        <div className="card-body">
          <div className="rows">
            {Object.entries(SUPPLIERS_BY_CHANNEL).map(([channel, list]) => (
              <div className="row" key={channel}>
                <div className="grow">
                  <p>{channel}</p>
                  <small>{list.join(", ")}</small>
                </div>
                <span className="num sub-line">{list.length}</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}
