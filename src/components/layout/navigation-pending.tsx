"use client";

import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";

type Navigate = (run: () => void) => void;

const NavigationPendingContext = createContext<{ navigate: Navigate; pending: boolean }>({
  navigate: (run) => run(),
  pending: false,
});

/**
 * Runs client-side navigations inside one React transition and locks the page while it is pending.
 * Wrap the app once; use `useNavigate()` (or the `Link` / `useRouter` wrappers) to navigate.
 */
export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const navigate = useCallback<Navigate>((run) => startTransition(run), []);
  const value = useMemo(() => ({ navigate, pending }), [navigate, pending]);
  return (
    <NavigationPendingContext.Provider value={value}>
      {children}
      {pending && <NavigationPendingOverlay />}
    </NavigationPendingContext.Provider>
  );
}

/** Returns `navigate(fn)`: runs `fn` (a router call) as a tracked navigation, and whether one is pending. */
export function useNavigationPending() {
  return useContext(NavigationPendingContext);
}

/**
 * Drop-in for `useRouter` from `next/navigation`: push / replace / refresh are tracked so the page is
 * locked until the new route has rendered.
 */
export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const { navigate } = useNavigationPending();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => navigate(() => router.push(...args)),
      replace: (...args: Parameters<typeof router.replace>) => navigate(() => router.replace(...args)),
      refresh: () => navigate(() => router.refresh()),
    }),
    [router, navigate],
  );
}

/**
 * Full-page click shield. Blocks pointer input immediately; the dim + spinner fade in after a short
 * delay (see `nav-pending-*` in globals.css) so fast navigations do not flash.
 */
function NavigationPendingOverlay() {
  const t = useTranslations("app");
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="nav-pending-overlay fixed inset-0 z-[200] cursor-wait bg-background/40 backdrop-blur-[1px] flex items-center justify-center"
    >
      <div className="nav-pending-bar absolute top-0 inset-x-0 h-0.5 bg-primary" />
      <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-md">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        <span>{t("loading")}</span>
      </div>
    </div>
  );
}
