import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The read-only feed another system calls — CFM Command, in the first case.
//
// Two things make this safe to point at a second business:
//
//   1. The caller never says whose data it wants. The key identifies a person,
//      and the function returns only the clients that person owns. There is no
//      parameter to tamper with.
//   2. There is no write path. This route reads; nothing here can change
//      anything in Mission Control.
//
// The key travels in the Authorization header rather than the URL, because a
// URL ends up in logs, browser history and referrer headers, and a key in any
// of those is a key that has leaked.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  if (!key) {
    return NextResponse.json(
      { error: "Send the key as: Authorization: Bearer <key>" },
      { status: 401 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("external_my_clients", { p_key: key });

  if (error) {
    console.error("[external] clients:", error.message);
    return NextResponse.json({ error: "That request could not be completed." }, { status: 500 });
  }

  // An unknown, revoked or mistyped key returns no rows — deliberately
  // indistinguishable from a valid key whose owner has no clients, so this
  // cannot be used to find out which keys exist.
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ clients: [] }, { headers: { "cache-control": "no-store" } });
  }

  const rows = data as {
    client_id: string;
    client_name: string;
    sector: string | null;
    status: string;
    campaigns: number;
    billings: number;
    last_campaign: string | null;
  }[];

  return NextResponse.json(
    {
      clients: rows.map((r) => ({
        id: r.client_id,
        name: r.client_name,
        sector: r.sector,
        status: r.status,
        campaigns: Number(r.campaigns),
        billingsExVat: Number(r.billings),
        lastCampaignEnded: r.last_campaign,
      })),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
