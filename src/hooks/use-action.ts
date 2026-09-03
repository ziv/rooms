"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/result";

/**
 * Runs a Server Action and toasts a localized error on failure.
 * onSuccess receives the data; onError may override the default toast.
 */
export function useAction() {
  const t = useTranslations("errors");
  const [pending, start] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: {
      onSuccess?: (data: T) => void;
      onError?: (r: Extract<ActionResult<T>, { ok: false }>) => boolean | void;
    } = {},
  ) {
    start(async () => {
      const r = await action();
      if (r.ok) {
        opts.onSuccess?.(r.data);
        return;
      }
      const handled = opts.onError?.(r);
      if (!handled) toast.error(t(r.code));
    });
  }

  return { run, pending };
}
