// Resend wrapper for the app's transactional email. DONE — do not modify the
// wiring; you can change the subject/body copy.
//
// During the workshop, EMAIL_FROM is the Resend test sender
// (onboarding@resend.dev), which can only deliver to your own account email —
// which is exactly who receives these confirmations. Verify your own domain
// after the program to send to anyone.
import { Resend } from "resend";

export async function sendRequestConfirmation(params: {
  to: string;
  name: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  // No key configured yet (e.g. first local run) — skip so the feature still works.
  if (!apiKey) {
    return { skipped: true as const };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: "We received your request",
    text: `Hi ${params.name}, thanks — we got your request and will be in touch.`,
  });

  if (error) {
    throw new Error(error.message);
  }
  return { id: data?.id };
}
