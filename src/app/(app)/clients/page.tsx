import { redirect } from "next/navigation";

// The Clients page is retired. Organisations shows the same companies with more
// besides — profit, margin, contacts, supplier spend — and can be edited, so
// keeping both invited the question "which one is right?".
//
// Kept as a redirect rather than deleted so existing bookmarks and any links
// still land somewhere sensible, filtered to clients.
export default function ClientsPage() {
  redirect("/organisations?lens=clients");
}
