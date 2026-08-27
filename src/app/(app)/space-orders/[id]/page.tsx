import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceOrder, requireFullAccess } from "@/lib/queries";
import SpaceOrderSheet from "@/components/SpaceOrderSheet";

export const dynamic = "force-dynamic";

// One booking line's Space Order, ready to print or save as a PDF.
export default async function SpaceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFullAccess();
  const { id } = await params;
  const order = await getSpaceOrder(id);
  if (!order) notFound();

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
            Space Order {order.po} · {order.supplier}
          </h1>
          <p>
            Sent to the media owner to confirm the booking. It shows the rate card, what we pay and
            VAT — never what the client is charged.
          </p>
        </div>
      </div>

      <SpaceOrderSheet order={order} />
    </div>
  );
}
