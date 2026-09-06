"use client";

import { forwardRef, useMemo, type ComponentProps, type MouseEvent } from "react";
import { Link as IntlLink, useRouter as useIntlRouter } from "./navigation-base";
import { useNavigationPending } from "@/components/layout/navigation-pending";

type LinkProps = ComponentProps<typeof IntlLink>;
type IntlRouter = ReturnType<typeof useIntlRouter>;

const isModifiedClick = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
const isExternalOrHash = (href: LinkProps["href"]) =>
  typeof href === "string" && (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#"));

/**
 * next-intl `Link` whose plain left-clicks navigate through the pending-navigation transition, so
 * the page is locked with a loading overlay until the target route has rendered. Modified clicks,
 * `target`, `download`, external and hash links keep the native behaviour.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { onClick, href, replace, scroll, locale, target, download, ...rest },
  ref,
) {
  const router = useIntlRouter();
  const { navigate } = useNavigationPending();
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || isModifiedClick(e)) return;
    if ((target && target !== "_self") || download != null || isExternalOrHash(href)) return;
    e.preventDefault();
    const go: IntlRouter["push"] = replace ? router.replace : router.push;
    navigate(() => go(href as Parameters<IntlRouter["push"]>[0], { scroll, locale }));
  };
  return (
    <IntlLink
      ref={ref}
      href={href}
      replace={replace}
      scroll={scroll}
      locale={locale}
      target={target}
      download={download}
      onClick={handleClick}
      {...rest}
    />
  );
});

/** next-intl `useRouter` whose push / replace / refresh are tracked by the pending-navigation lock. */
export function useRouter(): IntlRouter {
  const router = useIntlRouter();
  const { navigate } = useNavigationPending();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<IntlRouter["push"]>) => navigate(() => router.push(...args)),
      replace: (...args: Parameters<IntlRouter["replace"]>) => navigate(() => router.replace(...args)),
      refresh: () => navigate(() => router.refresh()),
    }),
    [router, navigate],
  );
}
