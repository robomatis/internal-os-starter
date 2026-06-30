// Server-side Intrix client (read-only). The reference for /integrate-api.
//
// If INTRIX_API_KEY / INTRIX_BASE_URL are unset, it serves bundled mock data and
// flags `mock: true` — so the module always works (the workshop fallback).
//
// NOTE: the endpoint/response shapes here are ASSUMED. Confirm them against the
// real Intrix API once the shared workshop key exists (spec §12.3).
import { MOCK_CONTACTS, type Contact } from "./mock-data";

const BASE = process.env.INTRIX_BASE_URL;
const KEY = process.env.INTRIX_API_KEY;

function authHeaders() {
  return { Authorization: `Bearer ${KEY}` };
}

export async function listContacts(): Promise<{
  contacts: Contact[];
  mock: boolean;
}> {
  if (!KEY || !BASE) {
    return { contacts: MOCK_CONTACTS, mock: true };
  }
  const res = await fetch(`${BASE}/contacts`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Intrix request failed: ${res.status}`);
  const data = (await res.json()) as { contacts?: Contact[] } | Contact[];
  const contacts = Array.isArray(data) ? data : (data.contacts ?? []);
  return { contacts, mock: false };
}

export async function getContact(id: string): Promise<{
  contact: Contact | null;
  mock: boolean;
}> {
  if (!KEY || !BASE) {
    return { contact: MOCK_CONTACTS.find((c) => c.id === id) ?? null, mock: true };
  }
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Intrix request failed: ${res.status}`);
  const contact = (await res.json()) as Contact;
  return { contact, mock: false };
}
