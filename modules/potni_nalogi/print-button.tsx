"use client";

import { Button } from "@/components/ui/button";

// Tiny client island: triggers the browser print dialog for the travel order.
// The detail view's print CSS hides the app chrome so only the document prints.
export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      Natisni potni nalog
    </Button>
  );
}
