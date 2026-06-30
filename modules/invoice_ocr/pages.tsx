import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/ai";
import { uploadInvoice, approveInvoice, rejectInvoice } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Status = "pending" | "approved" | "rejected";

type Invoice = {
  id: string;
  file_path: string;
  file_mime: string;
  vendor: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  net_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  status: Status;
  extracted_mock: boolean;
  reviewed_at: string | null;
  comment: string | null;
};

type LineRow = {
  line_no: number;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  net_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_amount: number | null;
};

const SELECT_COLS =
  "id, file_path, file_mime, vendor, invoice_number, issue_date, due_date, currency, net_amount, tax_amount, total_amount, status, extracted_mock, reviewed_at, comment";

// The liquidation states, with Slovenian labels + a badge colour each.
const STATUS: Record<
  Status,
  { label: string; variant: "secondary" | "default" | "destructive" }
> = {
  pending: { label: "Čaka na likvidacijo", variant: "secondary" },
  approved: { label: "Likvidiran", variant: "default" },
  rejected: { label: "Zavrnjen", variant: "destructive" },
};

function money(v: number | null, currency: string | null): string {
  if (v === null || v === undefined) return "—";
  const n = v.toLocaleString("sl-SI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${n} ${currency}` : n;
}

// Module entry: the list, or a single-invoice review screen when ?id= is set
// (the module router passes selectedId, same as crm_demo).
export async function InvoiceOcrModule({ selectedId }: { selectedId?: string }) {
  return selectedId ? <InvoiceDetail id={selectedId} /> : <InvoiceList />;
}

// ---------------------------------------------------------------- list view
async function InvoiceList() {
  const supabase = await createClient();
  // RLS scopes invoice_ocr_invoices to the signed-in user.
  const { data } = await supabase
    .from("invoice_ocr_invoices")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  const invoices = (data ?? []) as Invoice[];

  // One signed URL per stored file (the bucket is private) for the "Odpri" link.
  const urlByPath = new Map<string, string>();
  const paths = invoices.map((i) => i.file_path).filter(Boolean);
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("invoice_ocr")
      .createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Likvidacija računov</h1>
          {aiConfigured() ? null : <Badge variant="secondary">mock način</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Naloži račun (slika ali PDF). AI prebere podatke (OCR); odpri{" "}
          <strong>Preglej</strong> za predogled in likvidacijo s komentarjem — ali izvozi v CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Naloži račun</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadInvoice} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="file">Datoteka računa (PNG, JPG ali PDF)</Label>
              <input
                id="file"
                name="file"
                type="file"
                required
                accept="image/png,image/jpeg,application/pdf"
                className="block w-full max-w-sm rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <SubmitButton pendingText="Berem…">Naloži in preberi</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Največ 8 MB. Original se shrani v tvoj zasebni prostor (Supabase Storage).
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Računi za likvidacijo
          </h2>
          {invoices.length > 0 ? (
            <a
              href="/api/invoice_ocr/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Izvozi CSV
            </a>
          ) : null}
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dobavitelj</TableHead>
                  <TableHead>Št. računa</TableHead>
                  <TableHead>Izdan</TableHead>
                  <TableHead>Zapadlost</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">DDV</TableHead>
                  <TableHead className="text-right">Skupaj</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pregled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const st = STATUS[inv.status] ?? STATUS.pending;
                  const url = urlByPath.get(inv.file_path);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        {inv.vendor ?? "—"}
                        {inv.extracted_mock ? (
                          <Badge variant="secondary" className="ml-2">
                            mock
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{inv.invoice_number ?? "—"}</TableCell>
                      <TableCell>{inv.issue_date ?? "—"}</TableCell>
                      <TableCell>{inv.due_date ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(inv.net_amount, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(inv.tax_amount, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(inv.total_amount, inv.currency)}
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            Odpri
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/m/invoice_ocr?id=${inv.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Preglej
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Še ni računov. Naloži prvega zgoraj.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- detail view
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/m/invoice_ocr"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Nazaj na seznam
    </Link>
  );
}

async function InvoiceDetail({ id }: { id: string }) {
  const supabase = await createClient();
  // RLS scopes this to the signed-in user — a wrong/foreign id returns null.
  const { data } = await supabase
    .from("invoice_ocr_invoices")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  const inv = data as Invoice | null;

  if (!inv) {
    return (
      <div className="space-y-5">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Račun ni najden.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: signed } = await supabase.storage
    .from("invoice_ocr")
    .createSignedUrl(inv.file_path, 3600);
  const url = signed?.signedUrl;
  const st = STATUS[inv.status] ?? STATUS.pending;
  const isImage = inv.file_mime.startsWith("image/");

  // The extracted line items (normalized child rows), RLS-scoped to this user.
  const { data: lineData } = await supabase
    .from("invoice_ocr_line_items")
    .select(
      "line_no, description, quantity, unit, unit_price, net_amount, tax_rate, tax_amount, total_amount",
    )
    .eq("invoice_id", inv.id)
    .order("line_no", { ascending: true });
  const lines = (lineData ?? []) as LineRow[];

  return (
    <div className="space-y-5">
      <BackLink />

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{inv.vendor ?? "Račun"}</h1>
        <Badge variant={st.variant}>{st.label}</Badge>
        {inv.extracted_mock ? <Badge variant="secondary">mock</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Podatki računa (OCR)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Dobavitelj" value={inv.vendor ?? "—"} />
            <Field label="Št. računa" value={inv.invoice_number ?? "—"} />
            <Field label="Izdan" value={inv.issue_date ?? "—"} />
            <Field label="Zapadlost" value={inv.due_date ?? "—"} />
            <Field label="Valuta" value={inv.currency ?? "—"} />
            <Field label="Neto" value={money(inv.net_amount, inv.currency)} />
            <Field label="DDV" value={money(inv.tax_amount, inv.currency)} />
            <Field label="Skupaj" value={money(inv.total_amount, inv.currency)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Original</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {url ? (
              isImage ? (
                // Signed URL to a private object; plain <img> avoids next/image remote config.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt="Račun"
                  className="max-h-[70vh] w-full rounded-lg border object-contain"
                />
              ) : (
                <iframe
                  src={url}
                  title="Račun (PDF)"
                  className="h-[70vh] w-full rounded-lg border"
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Predogled ni na voljo.</p>
            )}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-primary underline-offset-4 hover:underline"
              >
                Odpri v novem zavihku
              </a>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Postavke računa</CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-right">#</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="text-right">Količina</TableHead>
                    <TableHead>EM</TableHead>
                    <TableHead className="text-right">Cena/EM</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">DDV %</TableHead>
                    <TableHead className="text-right">Skupaj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((li) => (
                    <TableRow key={li.line_no}>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {li.line_no}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal">
                        {li.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {li.quantity ?? "—"}
                      </TableCell>
                      <TableCell>{li.unit ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(li.unit_price, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(li.net_amount, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {li.tax_rate !== null ? `${li.tax_rate} %` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(li.total_amount, inv.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Postavke niso bile zaznane.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Likvidacija</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inv.status !== "pending" ? (
            <p className="text-sm text-muted-foreground">
              Trenutni status:{" "}
              <span className="font-medium text-foreground">{st.label}</span>
              {inv.reviewed_at ? " · pregledano" : ""}. Spodaj lahko odločitev spremeniš.
            </p>
          ) : null}
          {/* One form, shared comment + id. Likvidiraj uses the form action; Zavrni
              overrides it via formAction — robust regardless of button value forwarding. */}
          <form action={approveInvoice} className="space-y-3">
            <input type="hidden" name="id" value={inv.id} />
            <div className="space-y-1.5">
              <Label htmlFor="comment">Komentar (neobvezno)</Label>
              <textarea
                id="comment"
                name="comment"
                rows={3}
                maxLength={2000}
                defaultValue={inv.comment ?? ""}
                placeholder="npr. ujema se z naročilnico #123; potrjeno za plačilo."
                className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex gap-2">
              <SubmitButton pendingText="Shranjujem…">Likvidiraj</SubmitButton>
              <SubmitButton
                formAction={rejectInvoice}
                variant="outline"
                pendingText="Shranjujem…"
              >
                Zavrni
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
