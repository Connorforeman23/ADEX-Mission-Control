import { createClient } from "@/lib/supabase/server";
import BookingForm from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: staff }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_sales", true).order("full_name"),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Delivery</div>
          <h1>Book a campaign</h1>
          <p>
            Every booking line carries what the client is charged and what the supplier costs, so the
            invoice and the purchase order never get muddled.
          </p>
        </div>
      </div>

      <BookingForm clients={clients ?? []} staff={staff ?? []} />
    </div>
  );
}
