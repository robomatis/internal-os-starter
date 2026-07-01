import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { graphConfigured } from "./lib/graph";
import { zohoConfigured } from "./lib/zoho";
import { CopyButton } from "./copy-button";
import {
  syncEmails,
  dismissEmail,
  prepareQuote,
  saveItems,
  saveDraft,
  markSent,
  generateQuotePdf,
  pushQuoteToZoho,
} from "./actions";

const INPUT_CLASS =
  "flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Classification = "unclassified" | "quote_request" | "spam" | "other";
type EmailStatus = "new" | "quoted" | "dismissed";
type QuoteStatus = "draft" | "sent";

type EmailRow = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  received_at: string | null;
  classification: Classification;
  classify_reason: string | null;
  classify_mock: boolean;
  status: EmailStatus;
};

type QuoteRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  zoho_contact_id: string | null;
  currency: string;
  net_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  status: QuoteStatus;
  zoho_quote_id: string | null;
  pdf_path: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  compose_mock: boolean;
  created_at: string;
};

type ItemRow = {
  id: string;
  line_no: number;
  requested_text: string | null;
  sku: string | null;
  zoho_product_id: string | null;
  product_name: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  net_amount: number | null;
  tax_rate: number | null;
  confidence: number | null;
};

const CLASSIFICATION: Record<
  Classification,
  { label: string; variant: "secondary" | "default" | "destructive" | "outline" }
> = {
  unclassified: { label: "Nerazvrščeno", variant: "outline" },
  quote_request: { label: "Povpraševanje", variant: "default" },
  spam: { label: "Neželeno", variant: "destructive" },
  other: { label: "Drugo", variant: "secondary" },
};

function money(v: number | null, currency: string | null): string {
  if (v === null || v === undefined) return "—";
  const n = v.toLocaleString("sl-SI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${n} ${currency}` : n;
}

function dateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("sl-SI");
}

// Module entry: the inbox, or a single-quote review screen when ?id= is set.
export async function PonudbeModule({ selectedId }: { selectedId?: string }) {
  return selectedId ? <QuoteDetail id={selectedId} /> : <Inbox />;
}

// ---------------------------------------------------------------- inbox view
async function Inbox() {
  const supabase = await createClient();
  const { data: emailData } = await supabase
    .from("ponudbe_emails")
    .select(
      "id, from_email, from_name, subject, received_at, classification, classify_reason, classify_mock, status",
    )
    .order("received_at", { ascending: false, nullsFirst: false });
  const emails = (emailData ?? []) as EmailRow[];

  // Map each already-prepared email to its quote, so the row links straight to it.
  const { data: quoteData } = await supabase
    .from("ponudbe_quotes")
    .select("id, email_id");
  const quoteByEmail = new Map<string, string>();
  for (const q of quoteData ?? []) {
    if (q.email_id) quoteByEmail.set(q.email_id as string, q.id as string);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Ponudbe</h1>
          {graphConfigured() ? null : <Badge variant="secondary">mock način</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Sinhroniziraj e-pošto iz Outlooka, AI razvrsti povpraševanja, nato{" "}
          <strong>Pripravi ponudbo</strong> (ZOHO katalog → PDF + osnutek e-pošte).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vhodna e-pošta</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={syncEmails}>
            <SubmitButton pendingText="Sinhroniziram…">Sinhroniziraj e-pošto</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Bere zadnja sporočila iz nabiralnika (Microsoft Graph) in jih razvrsti. Brez
            ključev se uporabijo vzorčna sporočila.
          </p>
        </CardContent>
      </Card>

      {emails.length > 0 ? (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pošiljatelj</TableHead>
                <TableHead>Zadeva</TableHead>
                <TableHead>Prejeto</TableHead>
                <TableHead>Klasifikacija</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcija</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((e) => {
                const cls = CLASSIFICATION[e.classification] ?? CLASSIFICATION.unclassified;
                const quoteId = quoteByEmail.get(e.id);
                const dimmed = e.status === "dismissed" || e.classification === "spam";
                return (
                  <TableRow key={e.id} className={dimmed ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      {e.from_name ?? e.from_email ?? "—"}
                      {e.from_name && e.from_email ? (
                        <div className="text-xs font-normal text-muted-foreground">
                          {e.from_email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{e.subject ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {dateTime(e.received_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cls.variant}>{cls.label}</Badge>
                      {e.classify_mock ? (
                        <Badge variant="secondary" className="ml-1">
                          mock
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.status === "quoted"
                        ? "Pripravljena"
                        : e.status === "dismissed"
                          ? "Zavržena"
                          : "Nova"}
                    </TableCell>
                    <TableCell className="text-right">
                      {quoteId ? (
                        <Link
                          href={`/m/ponudbe?id=${quoteId}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Odpri ponudbo
                        </Link>
                      ) : e.classification === "quote_request" && e.status !== "dismissed" ? (
                        <form action={prepareQuote} className="inline">
                          <input type="hidden" name="email_id" value={e.id} />
                          <SubmitButton size="sm" pendingText="Pripravljam…">
                            Pripravi ponudbo
                          </SubmitButton>
                        </form>
                      ) : e.status !== "dismissed" ? (
                        <form action={dismissEmail} className="inline">
                          <input type="hidden" name="id" value={e.id} />
                          <SubmitButton size="sm" variant="ghost" pendingText="…">
                            Zavrži
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
            Še ni povpraševanj. Klikni „Sinhroniziraj e-pošto“ zgoraj.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- detail view
function BackLink() {
  return (
    <Link
      href="/m/ponudbe"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Nazaj na seznam
    </Link>
  );
}

const QUOTE_STATUS: Record<QuoteStatus, { label: string; variant: "secondary" | "default" }> = {
  draft: { label: "Osnutek", variant: "secondary" },
  sent: { label: "Poslano", variant: "default" },
};

async function QuoteDetail({ id }: { id: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ponudbe_quotes")
    .select(
      "id, customer_name, customer_email, zoho_contact_id, currency, net_amount, tax_amount, total_amount, status, zoho_quote_id, pdf_path, draft_subject, draft_body, compose_mock, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  const quote = data as QuoteRow | null;

  if (!quote) {
    return (
      <div className="space-y-5">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ponudba ni najdena.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: itemData } = await supabase
    .from("ponudbe_quote_items")
    .select(
      "id, line_no, requested_text, sku, zoho_product_id, product_name, description, quantity, unit, unit_price, net_amount, tax_rate, confidence",
    )
    .eq("quote_id", id)
    .order("line_no", { ascending: true });
  const items = (itemData ?? []) as ItemRow[];

  let pdfUrl: string | undefined;
  if (quote.pdf_path) {
    const { data: signed } = await supabase.storage
      .from("ponudbe")
      .createSignedUrl(quote.pdf_path, 3600);
    pdfUrl = signed?.signedUrl;
  }

  const st = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.draft;
  const currency = quote.currency ?? "EUR";

  return (
    <div className="space-y-5">
      <BackLink />

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {quote.customer_name ?? "Ponudba"}
        </h1>
        <Badge variant={st.variant}>{st.label}</Badge>
        {quote.compose_mock ? <Badge variant="secondary">mock</Badge> : null}
        {quote.zoho_quote_id ? <Badge variant="outline">v ZOHO</Badge> : null}
      </div>

      {/* Customer */}
      <Card>
        <CardHeader>
          <CardTitle>Stranka</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Ime</div>
            <div className="mt-0.5">{quote.customer_name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">E-pošta</div>
            <div className="mt-0.5">{quote.customer_email ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ZOHO kontakt</div>
            <div className="mt-0.5">{quote.zoho_contact_id ?? "ni najden"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Line items — editable */}
      <Card>
        <CardHeader>
          <CardTitle>Postavke ponudbe</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <form action={saveItems} className="space-y-3">
              <input type="hidden" name="quote_id" value={quote.id} />
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      <TableHead>Izdelek</TableHead>
                      <TableHead className="w-24 text-right">Količina</TableHead>
                      <TableHead className="w-28 text-right">Cena/EM</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">Zaupanje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((li) => {
                      const unmatched = !li.zoho_product_id;
                      return (
                        <TableRow
                          key={li.id}
                          className={unmatched ? "bg-destructive/5" : undefined}
                        >
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {li.line_no}
                          </TableCell>
                          <TableCell>
                            <input
                              name={`name_${li.id}`}
                              defaultValue={li.product_name ?? ""}
                              className={INPUT_CLASS}
                            />
                            {li.requested_text && li.requested_text !== li.product_name ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Zahteva: {li.requested_text}
                              </div>
                            ) : null}
                            {unmatched ? (
                              <div className="mt-1 text-xs text-destructive">
                                Brez ujemanja v ZOHO — preveri ročno.
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <input
                              name={`qty_${li.id}`}
                              type="number"
                              step="0.001"
                              min="0"
                              defaultValue={li.quantity ?? 1}
                              className={`${INPUT_CLASS} text-right`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <input
                              name={`price_${li.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={li.unit_price ?? 0}
                              className={`${INPUT_CLASS} text-right`}
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(li.net_amount, currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {li.confidence !== null
                              ? `${Math.round(li.confidence * 100)} %`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Neto {money(quote.net_amount, currency)} · DDV{" "}
                  {money(quote.tax_amount, currency)} ·{" "}
                  <span className="font-medium text-foreground">
                    Skupaj {money(quote.total_amount, currency)}
                  </span>
                </div>
                <SubmitButton pendingText="Shranjujem…">Shrani postavke</SubmitButton>
              </div>
            </form>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ni postavk. Vrni se na seznam in pripravi ponudbo znova.
            </p>
          )}
        </CardContent>
      </Card>

      {/* PDF */}
      <Card>
        <CardHeader>
          <CardTitle>PDF ponudbe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <form action={generateQuotePdf}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <SubmitButton variant={pdfUrl ? "outline" : "default"} pendingText="Ustvarjam…">
                {pdfUrl ? "Ustvari znova" : "Ustvari PDF"}
              </SubmitButton>
            </form>
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Odpri PDF
              </a>
            ) : null}
          </div>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Ponudba (PDF)"
              className="h-[70vh] w-full rounded-lg border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              PDF še ni ustvarjen. Najprej uredi postavke, nato klikni „Ustvari PDF“.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Draft email — draft only, never auto-sent */}
      <Card>
        <CardHeader>
          <CardTitle>Osnutek e-pošte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={saveDraft} className="space-y-3">
            <input type="hidden" name="quote_id" value={quote.id} />
            <div className="space-y-1.5">
              <Label htmlFor="draft_subject">Zadeva</Label>
              <input
                id="draft_subject"
                name="draft_subject"
                defaultValue={quote.draft_subject ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="draft_body">Sporočilo</Label>
              <textarea
                id="draft_body"
                name="draft_body"
                rows={10}
                defaultValue={quote.draft_body ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton pendingText="Shranjujem…">Shrani osnutek</SubmitButton>
              <CopyButton text={quote.draft_body ?? ""} label="Kopiraj besedilo" />
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <form action={markSent}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <SubmitButton
                variant="outline"
                pendingText="…"
                disabled={quote.status === "sent"}
              >
                {quote.status === "sent" ? "Označeno kot poslano" : "Označi kot poslano"}
              </SubmitButton>
            </form>
            <p className="text-xs text-muted-foreground">
              Osnutek — pregledaj in pošlji ročno iz Outlooka. Sistem e-pošte ne pošilja
              samodejno.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ZOHO write-back */}
      <Card>
        <CardHeader>
          <CardTitle>ZOHO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {quote.zoho_quote_id ? (
            <p className="text-sm text-muted-foreground">
              Poslano v ZOHO · ID:{" "}
              <span className="font-mono text-foreground">{quote.zoho_quote_id}</span>
            </p>
          ) : (
            <form action={pushQuoteToZoho}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <SubmitButton pendingText="Pošiljam…">Pošlji v ZOHO</SubmitButton>
            </form>
          )}
          {zohoConfigured() ? null : (
            <p className="text-xs text-muted-foreground">
              ZOHO ni nastavljen — prenos teče v mock načinu (ne ustvari pravega zapisa).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
