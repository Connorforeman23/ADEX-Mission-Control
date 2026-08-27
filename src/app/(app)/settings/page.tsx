import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireFullAccess, getMyProfile } from "@/lib/queries";
import { COMMISSION_RATE, MARGIN_FLOOR, VAT_RATE, initials } from "@/lib/money";
import { INVOICE_TOLERANCE } from "@/lib/po";
import { SUPPLIERS_BY_CHANNEL } from "@/lib/reference";
import TeamAdmin from "@/components/TeamAdmin";
import ActivityLog from "@/components/ActivityLog";
import XeroPanel from "@/components/XeroPanel";

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
        <section className="card">
          <div className="card-head">
            <h2>Team</h2>
            <span className="sub">{members.length} signed up</span>
          </div>
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
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Commission defaults</h2>
            <span className="sub">Supplier gross less…</span>
          </div>
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
        </section>
      </div>

      {isAdmin && <TeamAdmin />}

      {isAdmin && (
        <Suspense fallback={null}>
          <XeroPanel />
        </Suspense>
      )}

      {isAdmin && <ActivityLog />}

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Rules</h2>
            <span className="sub">Applied across the app</span>
          </div>
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
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Connections</h2>
            <span className="sub">None live yet</span>
          </div>
          <div className="card-body">
            <div className="rows">
              {[
                ["Xero", "POs push as bills; invoices drafted at client gross"],
                ["Google Ads reporting", "Pulls spend and conversions into Reports"],
                ["Meta reporting", "Pulls spend and leads into Reports"],
                ["Email (SMTP)", "Password resets and notifications from your own domain"],
              ].map(([name, detail]) => (
                <div className="row" key={name}>
                  <div className="grow">
                    <p>{name}</p>
                    <small>{detail}</small>
                  </div>
                  <span className="st done">Not connected</span>
                </div>
              ))}
            </div>
            <p className="sub-line" style={{ marginTop: 10 }}>
              Each of these is a real integration to build — nothing here is wired up yet.
            </p>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Supplier rosters</h2>
          <span className="sub">Offered in the booking form, per channel</span>
        </div>
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
      </section>
    </div>
  );
}
