/**
 * Locale-aware navigation. `Link` and `useRouter` run navigations through the page-wide pending lock
 * (see `@/components/layout/navigation-pending`); the rest is next-intl as is.
 */
export { redirect, usePathname, getPathname } from "./navigation-base";
export { Link, useRouter } from "./link";
