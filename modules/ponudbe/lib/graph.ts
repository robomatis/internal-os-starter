// Server-only Microsoft Graph client (read-only inbox). Modeled on crm_demo/lib/intrix.ts:
// reads one configured mailbox via the app-only client-credentials flow, and with NO
// credentials falls back to bundled mock emails so the module works end-to-end.
//
// Setup (one-time, out of band): register an app in Entra ID, grant the APPLICATION
// permission Mail.Read with admin consent, create a client secret. Then set the GRAPH_*
// vars below. The token is fetched on demand and cached in memory for its ~1h life —
// never stored in the database.
import "server-only";
import { MOCK_EMAILS, type PonudbeEmail } from "./mock-data";

const TENANT = process.env.GRAPH_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;
const MAILBOX = process.env.GRAPH_MAILBOX;
const FOLDER = process.env.GRAPH_MAILBOX_FOLDER ?? "Inbox";

/** True when every Graph var is set, so we can talk to the real mailbox. */
export function graphConfigured(): boolean {
  return Boolean(TENANT && CLIENT_ID && CLIENT_SECRET && MAILBOX);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Reuse the cached token until ~1 min before expiry.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph token failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

type GraphMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
};

function fromGraph(m: GraphMessage): PonudbeEmail {
  return {
    message_id: m.id,
    from_email: m.from?.emailAddress?.address ?? null,
    from_name: m.from?.emailAddress?.name ?? null,
    subject: m.subject ?? null,
    received_at: m.receivedDateTime ?? null,
    body_text: m.body?.content ?? m.bodyPreview ?? null,
  };
}

/** The most recent messages from the configured mailbox folder (read-only). */
export async function listQuoteRequestEmails(): Promise<{
  messages: PonudbeEmail[];
  mock: boolean;
}> {
  if (!graphConfigured()) {
    return { messages: MOCK_EMAILS, mock: true };
  }
  const token = await getAccessToken();
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAILBOX!)}` +
    `/mailFolders/${encodeURIComponent(FOLDER)}/messages` +
    `?$top=25&$orderby=receivedDateTime%20desc` +
    `&$select=id,subject,from,receivedDateTime,bodyPreview,body`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // Ask Graph for the plain-text body (we never render email HTML).
      Prefer: 'outlook.body-content-type="text"',
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph messages failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { value?: GraphMessage[] };
  return { messages: (json.value ?? []).map(fromGraph), mock: false };
}
