"use client";

// Fires a toast from `?ok=…` / `?error=…` query params (set by Server Actions on
// redirect), then strips them so a refresh doesn't re-toast. Render inside <Suspense>.
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function ToastFromParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const ok = params.get("ok");
    const error = params.get("error");
    if (!ok && !error) return;
    if (ok) toast.success(ok === "1" ? "Done." : ok);
    if (error) toast.error(error);
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("error");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname);
  }, [params, router, pathname]);

  return null;
}
