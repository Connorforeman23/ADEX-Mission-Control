import { getCampaigns } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  CHANNELS,
  CHANNEL_COLOUR,
  channelLabel,
  clientGross,
  commissionOf,
  dealMargin,
  dealProfit,
  gbp,
  gbpK,
  markupOf,
  MARGIN_FLOOR,
  STATUS_LABEL,
  supplierNet,
  vatOn,
} from "@/lib/money";
import { buildPurchaseOrders, reconcile, type SupplierInvoice } from "@/lib/po";
import PoTable from "@/components/PoTable";
import BarList, { type BarRow } from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const supabase = await createClient();
  const [campaigns, { data: invoiceRows }] = await Promise.all([
    getCampaigns(),
    supabase
      .from("supplier_invoices")
      .select("campaign_line_id, invoice_no, invoice_date, amount, approved"),
  ]);

  const invoices = (invoiceRows ?? []) as SupplierInvoice[];
  const invoiceMap = new Map(invoices.map((i) => [i.campaign_line_id, i]));
  const orders = buildPurchaseOrders(campaigns);

  const billings = campaigns.reduce((a, c) => a + clientGross(c), 0);
  const profit = campaigns.reduce((a, c) => a + dealProfit(c), 0);
  const commission = campaigns.reduce((a, c) => a + commissionOf(c), 0);
  const markup = campaigns.reduce((a, c) => a + markupOf(c), 0);
  const fees = campaigns.reduce((a, c) => a + Number(c.fee), 0);

  const recons = orders.map((po) => reconcile(po, invoiceMap));
  const variances = recons.filter((r) => r.state === "variance");
  const awaiting = recons.filter((r) => r.state === "awaiting").length;
  const varianceTotal = variances.reduce(
    (a, v) => a + (v.state === "variance" ? v.diff : 0),
    0
  );

  const channelRows: BarRow[] = CHANNELS.map((ch) => ({
    label: channelLabel(ch),
    colour: CHANNEL_COLOUR[ch],
    value: campaigns
      .flatMap((c) => c.campaign_lines)
      .filter((l) => l.channel === ch)
      .reduce((a, l) => a + Number(l.client_charge), 0),
  })).filter((r) => r.value > 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Commercial</div>
          <h1>Finance</h1>
          <p>
            Invoicing runs at client gross ex VAT; suppliers are paid at gross less 15%, with VAT
            charged on the net. Click a purchase order to see it and reconcile the supplier invoice.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="eyebrow">Billings — ex VAT</div>
          <div className="num kpi-value">{gbpK(billings)}</div>
          <div className="kpi-foot">+ {gbpK(vatOn(billings))} VAT invoiced</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Profit</div>
          <div className="num kpi-value" style={{ color: "var(--ok)" }}>
            {gbpK(profit)}
          </div>
          <div className="kpi-foot">
            {gbpK(commission)} commission · {gbpK(markup)} markup · {gbpK(fees)} fees
          </div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">Purchase orders</div>
          <div className="num kpi-value">{orders.length}</div>
          <div className="kpi-foot">{awaiting} awaiting invoice</div>
        </div>
        <div className="card kpi">
          <div className="eyebrow">PO variances</div>
          <div className="num kpi-value" style={{ color: variances.length ? "var(--crit)" : "var(--ok)" }}>
            {variances.length}
          </div>
          <div className="kpi-foot">
            {variances.length
              ? `${varianceTotal > 0 ? "+" : "−"}${gbp(Math.abs(varianceTotal))} vs PO net`
              : "All invoices matched"}
          </div>
        </div>
      </div>

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Billings by channel</h2>
            <span className="sub">Client charge, ex VAT</span>
          </div>
          <div className="card-body">
            <BarList rows={channelRows} empty="No booking lines yet." />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Campaign ledger</h2>
            <span className="sub">Profit = client gross − supplier net</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {campaigns.length === 0 ? (
              <p className="empty-note" style={{ padding: "18px 16px" }}>
                No campaigns booked yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>Campaign</th>
                      <th className="r">Gross</th>
                      <th className="r">Net</th>
                      <th className="r">Profit</th>
                      <th className="r">Margin</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => {
                      const margin = dealMargin(c);
                      const low = clientGross(c) > 0 && margin < MARGIN_FLOOR;
                      return (
                        <tr key={c.id}>
                          <td className="num ref">{c.ref}</td>
                          <td>
                            <div className="strong">{c.name}</div>
                            <div className="sub-line">{c.clients?.name ?? "—"}</div>
                          </td>
                          <td className="r num">{gbp(clientGross(c))}</td>
                          <td className="r num" style={{ color: "var(--mid)" }}>
                            {gbp(supplierNet(c))}
                          </td>
                          <td className="r num" style={{ color: low ? "var(--crit)" : "var(--ok)" }}>
                            {gbp(dealProfit(c))}
                          </td>
                          <td className="r num" style={{ color: low ? "var(--crit)" : undefined }}>
                            {margin.toFixed(1)}%{low ? " ⚠" : ""}
                          </td>
                          <td>
                            <span className={`st ${c.status}`}>
                              {STATUS_LABEL[c.status] ?? c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      <PoTable orders={orders} invoices={invoices} />
    </div>
  );
}
