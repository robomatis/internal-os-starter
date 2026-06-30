"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect("/setup-password?error=Password+must+be+at+least+8+characters.");
  }
  if (password !== confirm) {
    redirect("/setup-password?error=Passwords+do+not+match.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/setup-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/home?ok=Password+set.");
}
