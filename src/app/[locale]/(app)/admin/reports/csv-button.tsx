"use client";

import { Button } from "@/components/ui/button";

export function CsvButton({ href, label, warning }: { href: string; label: string; warning: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (window.confirm(warning)) window.open(href, "_blank");
      }}
    >
      {label}
    </Button>
  );
}
