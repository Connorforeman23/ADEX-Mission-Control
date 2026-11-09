import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/queries";
import BookingImport from "@/components/BookingImport";

export const dynamic = "force-dynamic";

// Loading history in bulk.
//
// Admin only: this writes campaigns and lines straight to the books, and a
// mistake here is a mistake across a whole year rather than one booking.
export default async function ImportPage() {
  const profile = await getMyProfile();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Import bookings</h1>
          <p>
            A year of history from a spreadsheet. This does not wait on Xero &mdash; Xero holds
            invoices, and a booking is a supplier, a publication, dates and what was paid and
            charged. That comes out of Sage, the Space Orders already filed, or whatever
            spreadsheet the work was tracked in.
          </p>
        </div>
      </div>

      <BookingImport />
    </div>
  );
}
