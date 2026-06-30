import { redirect } from "next/navigation";

// This is an internal tool — no public landing page. Send everyone to the
// launcher, which bounces to /login if they're not signed in.
export default function RootPage() {
  redirect("/home");
}
