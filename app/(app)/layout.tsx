import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/access";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ToastFromParams } from "@/components/toast-from-params";

// Auth guard for the whole signed-in area. DONE — do not modify.
// MODULE access is enforced separately, per request, in app/m/[module]/page.tsx.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // A deactivated user keeps a session but can't reach any app route.
  const profile = await getProfile(supabase, user.id);
  if (profile?.disabled) {
    redirect("/login?error=Your+account+has+been+disabled.");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header email={user.email} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-10">
        {children}
      </main>
      <Footer />
      <Suspense>
        <ToastFromParams />
      </Suspense>
    </div>
  );
}
