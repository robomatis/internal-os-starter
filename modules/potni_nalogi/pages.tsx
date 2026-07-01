import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createNalog } from "./actions";
import { PrintButton } from "./print-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

type Nalog = {
  id: string;
  stranka: string;
  kraj_od: string;
  kraj_do: string;
  datum: string;
  namen: string | null;
  km: number | null;
  distance_mock: boolean;
  created_at: string;
};

const SELECT_COLS =
  "id, stranka, kraj_od, kraj_do, datum, namen, km, distance_mock, created_at";

function km(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("sl-SI", { maximumFractionDigits: 1 })} km`;
}

// Module entry: the list, or a single travel-order document when ?id= is set
// (the module router passes selectedId, same as crm_demo / invoice_ocr).
export async function PotniNalogiModule({ selectedId }: { selectedId?: string }) {
  return selectedId ? <NalogDocument id={selectedId} /> : <NalogList />;
}

// ---------------------------------------------------------------- list view
async function NalogList() {
  const supabase = await createClient();
  // RLS scopes potni_nalogi_zapisi to the signed-in user.
  const { data } = await supabase
    .from("potni_nalogi_zapisi")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  const nalogi = (data ?? []) as Nalog[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Potni nalogi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vnesi stranko, relacijo in datum — km izračuna Google Maps. Odpri zapis za
          tiskalni pogled potnega naloga.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nov potni nalog</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createNalog} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="stranka">Stranka</Label>
              <Input id="stranka" name="stranka" required maxLength={200} placeholder="npr. Acme d.o.o." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kraj_od">Kraj odhoda</Label>
              <Input id="kraj_od" name="kraj_od" required maxLength={200} placeholder="npr. Ljubljana" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kraj_do">Cilj</Label>
              <Input id="kraj_do" name="kraj_do" required maxLength={200} placeholder="npr. Maribor" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="datum">Datum</Label>
              <Input id="datum" name="datum" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="namen">Namen poti (neobvezno)</Label>
              <Input id="namen" name="namen" maxLength={500} placeholder="npr. sestanek pri stranki" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Računam km…">Shrani in izračunaj km</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Shranjeni potni nalogi</h2>
        {nalogi.length > 0 ? (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Stranka</TableHead>
                  <TableHead>Relacija</TableHead>
                  <TableHead className="text-right">Razdalja</TableHead>
                  <TableHead className="text-right">Nalog</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nalogi.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{n.datum}</TableCell>
                    <TableCell className="font-medium">{n.stranka}</TableCell>
                    <TableCell>
                      {n.kraj_od} → {n.kraj_do}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {km(n.km)}
                      {n.distance_mock ? (
                        <Badge variant="secondary" className="ml-2">mock</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/m/potni_nalogi?id=${n.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Odpri
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Še ni potnih nalogov. Ustvari prvega zgoraj.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------- the printable document
function DocField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

async function NalogDocument({ id }: { id: string }) {
  const supabase = await createClient();
  // RLS scopes this to the signed-in user — a wrong/foreign id returns null.
  const { data } = await supabase
    .from("potni_nalogi_zapisi")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  const n = data as Nalog | null;

  if (!n) {
    return (
      <div className="space-y-5">
        <Link
          href="/m/potni_nalogi"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Nazaj na seznam
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Potni nalog ni najden.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/m/potni_nalogi"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Nazaj na seznam
        </Link>
        <PrintButton />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Potni nalog</CardTitle>
            {n.distance_mock ? <Badge variant="secondary">mock razdalja</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <DocField label="Stranka" value={n.stranka} />
          <DocField label="Datum" value={n.datum} />
          <DocField label="Kraj odhoda" value={n.kraj_od} />
          <DocField label="Cilj" value={n.kraj_do} />
          <DocField label="Razdalja" value={km(n.km)} />
          <DocField label="Namen poti" value={n.namen ?? "—"} />
          <div className="mt-8 sm:col-span-2">
            <div className="text-xs text-muted-foreground">Podpis</div>
            <div className="mt-8 border-t border-foreground/40 pt-1 text-xs text-muted-foreground">
              podpis voznika
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
