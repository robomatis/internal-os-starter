import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listContacts, getContact } from "./lib/intrix";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

export async function CrmDemoModule({ selectedId }: { selectedId?: string }) {
  // Detail view
  if (selectedId) {
    const { contact, mock } = await getContact(selectedId);
    return (
      <div className="space-y-5">
        <Link
          href="/m/crm_demo"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to contacts
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {contact?.name ?? "Contact not found"}
          </h1>
          {mock ? <Badge variant="secondary">demo data</Badge> : null}
        </div>
        {contact ? (
          <Card>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <Field label="Company" value={contact.company} />
              <Field label="Email" value={contact.email} />
              <Field label="Phone" value={contact.phone} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  // List view
  const { contacts, mock } = await listContacts();
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          {mock ? <Badge variant="secondary">demo data</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only, pulled from Intrix — the reference for{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/integrate-api</code>.
        </p>
      </div>
      <div className="space-y-2">
        {contacts.map((c) => (
          <Link
            key={c.id}
            href={`/m/crm_demo?id=${encodeURIComponent(c.id)}`}
            className="group block"
          >
            <Card size="sm" className="transition group-hover:ring-foreground/25">
              <CardContent className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-muted-foreground">{c.company}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
