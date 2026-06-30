import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userCanAccess, moduleIsEnabled } from "@/lib/access";
import { getModule } from "@/modules/_registry";
import { AdminModule } from "@/modules/admin/pages";
import { CrmDemoModule } from "@/modules/crm_demo/pages";
import { AiAssistModule } from "@/modules/ai_assist/pages";
import { InvoiceOcrModule } from "@/modules/invoice_ocr/pages";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The single module router. One guard, one place: access is enforced HERE,
// server-side, on every request — a member cannot reach a module by URL.
// DONE — do not modify the guard. Add new modules to the switch below.
export default async function ModuleRouter({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { module } = await params;
  const { id } = await searchParams;

  const def = getModule(module);
  if (!def) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowed = await userCanAccess(supabase, user.id, module);
  if (!allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No access</CardTitle>
          <CardDescription>
            You don&rsquo;t have access to &ldquo;{def.name}&rdquo;. Ask your
            workspace owner to grant it in Admin.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // A module the owner has switched off is blocked even for granted users.
  if (!(await moduleIsEnabled(supabase, module))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unavailable</CardTitle>
          <CardDescription>
            &ldquo;{def.name}&rdquo; is currently turned off by your workspace owner.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  switch (module) {
    case "admin":
      return <AdminModule />;
    case "crm_demo":
      return <CrmDemoModule selectedId={id} />;
    case "ai_assist":
      return <AiAssistModule />;
    case "invoice_ocr":
      return <InvoiceOcrModule selectedId={id} />;
    default:
      notFound();
  }
}
