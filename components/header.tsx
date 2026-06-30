import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function Header({ email }: { email?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-6">
        <Link href="/home" className="text-sm font-semibold tracking-tight">
          Internal OS
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {email ? <span className="text-muted-foreground">{email}</span> : null}
          <form action={signOut}>
            <SubmitButton variant="outline" size="sm" pendingText="Signing out…">
              Sign out
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
