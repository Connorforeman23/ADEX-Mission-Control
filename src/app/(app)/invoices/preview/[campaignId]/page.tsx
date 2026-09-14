import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoicePreview, requireFullAccess } from "@/lib/queries";
import InvoiceSheet from "@/components/InvoiceSheet";

export const dynamic = "force-dynamic";

// What the invoice for this campaign WOULD be. Nothing is written until
// "Save as draft" — so a wrong campaign, a wrong figure or a change of mind
// costs nothing and leaves nothing behind.
export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireFullAccess();
  const { campaignId } = await params;
  const invoice = await getInvoicePreview(campaignId);
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
          <h1>Invoice preview · {invoice.client}</h1>
          <p>
            {invoice.campaignRef} · {invoice.campaignName} — check it, edit it, then save it as a
            draft.
          </p>
        </div>
      </div>

      <InvoiceSheet invoice={invoice} />
    </div>
  );
}
