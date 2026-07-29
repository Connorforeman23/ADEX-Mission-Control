import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

// Wraps every signed-in page with the navigation shell. Auth pages live
// outside this group so they render without it.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <AppShell fullName={profile?.full_name ?? user.email ?? "User"} role={profile?.role ?? "standard"}>
      {children}
    </AppShell>
  );
}
