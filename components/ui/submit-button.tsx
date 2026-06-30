"use client";

// Submit button for Server Action forms. While the action runs it shows a
// spinner AND disables itself — so the user gets feedback and can't double-click.
// DONE — use this for every form submit instead of a bare <button>/<Button>.
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ComponentProps } from "react";

type Props = ComponentProps<typeof Button> & { pendingText?: string };

export function SubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
