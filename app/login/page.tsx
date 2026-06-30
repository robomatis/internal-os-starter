import Link from "next/link";
import { signIn, signUp } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// DONE — do not modify this flow. Password sign-in/sign-up via Server Actions.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl tracking-tight">
              {isSignup ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {isSignup ? "Use your email and a password." : "Sign in to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
            <form action={isSignup ? signUp : signIn} className="space-y-4">
              {isSignup ? (
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Name</Label>
                  <Input id="full_name" name="full_name" autoComplete="name" />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </div>
              <SubmitButton
                size="lg"
                className="w-full"
                pendingText={isSignup ? "Creating…" : "Signing in…"}
              >
                {isSignup ? "Create account" : "Sign in"}
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/login">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/login?mode=signup">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
