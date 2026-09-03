"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-muted-foreground">Something went wrong.</p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
