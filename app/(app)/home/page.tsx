import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLauncherModules } from "@/lib/access";
import { Card, CardContent } from "@/components/ui/card";

// The module launcher: shows ONLY the modules this user is granted AND that are
// enabled, in the owner-defined order. Labels come from the catalogue (DB).
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const modules = await getLauncherModules(supabase, user!.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the modules you&rsquo;ve been granted appear here.
        </p>
      </div>

      {modules.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <Link key={m.id} href={`/m/${m.id}`} className="group block">
              <Card
                size="sm"
                className="h-full transition group-hover:ring-foreground/25 group-hover:shadow-sm"
              >
                <CardContent className="space-y-1">
                  <div className="text-2xl">{m.icon}</div>
                  <div className="font-medium">{m.label}</div>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No modules yet. Ask your workspace owner to grant you access.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
