import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { userCanAccess } from "@/lib/access";

// CSV export of the user's invoices. This is a SEPARATE entry point from the page, so
// it repeats the auth + access check (a member without the module can't fetch it). RLS
// scopes the query to the signed-in user. To support an accounting import, add a new
// ?format=… branch below (e.g. e-SLOG XML or JSON) — the rest stays the same.
const MODULE = "invoice_ocr";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!(await userCanAccess(supabase, user.id, MODULE)))
    return new NextResponse("Forbidden", { status: 403 });

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  if (format !== "csv")
    return new NextResponse(`Nepodprt format: ${format}`, { status: 400 });

  const { data } = await supabase
    .from("invoice_ocr_invoices")
    .select(
      "vendor, invoice_number, issue_date, due_date, currency, net_amount, tax_amount, total_amount, status, comment, created_at",
    )
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  const header = [
    "Dobavitelj",
    "Št. računa",
    "Izdan",
    "Zapadlost",
    "Valuta",
    "Neto",
    "DDV",
    "Skupaj",
    "Status",
    "Komentar",
    "Naloženo",
  ];
  const body = rows.map((r) => [
    r.vendor,
    r.invoice_number,
    r.issue_date,
    r.due_date,
    r.currency,
    r.net_amount,
    r.tax_amount,
    r.total_amount,
    r.status,
    r.comment,
    r.created_at,
  ]);

  // Prepend a UTF-8 BOM (﻿) so č/š/ž open correctly in Excel.
  const csv = "﻿" + toCsv([header, ...body]);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="racuni-${today}.csv"`,
    },
  });
}

// Minimal RFC-4180 CSV. Two safeguards: (1) quote a field that contains a comma,
// quote, or newline (doubling internal quotes); (2) FORMULA-INJECTION guard — these
// values come from OCR of untrusted documents, so a cell that starts with = + - @ tab
// or CR (which Excel/Sheets would run as a formula) gets a leading apostrophe. Applied
// to every cell, since OCR amounts aren't guaranteed to be numeric. No dependency.
function toCsv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
