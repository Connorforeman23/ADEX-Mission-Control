import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientInvoice, requireFullAccess } from "@/lib/queries";
import InvoiceSheet from "@/components/InvoiceSheet";

export const dynamic = "force-dynamic";

// One campaign's client invoice, checked and edited here before it goes to
// Xero. Nothing is sent from this page — it exists so the numbers and wording
// can be read in full while they are still a draft.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireFullAccess();
  const { id } = await params;
  const invoice = await getClientInvoice(id);
  if (!invoice) notFound();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link href="/finance" style={{ color: "var(--blue)" }}>
              Finance
            </Link>
          </div>
          <h1>
            Invoice {invoice.invoiceNo ?? "draft"} · {invoice.client}
          </h1>
          <p>
            {invoice.campaignRef} · {invoice.campaignName}
            {invoice.status === "Draft"
              ? " — a draft. Edit the wording and amounts here, then print or push it to Xero."
              : ` — ${invoice.status}.`}
          </p>
        </div>
      </div>

      <InvoiceSheet invoice={invoice} />
    </div>
  );
}
