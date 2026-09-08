"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & { href: string; exact?: boolean };

/** Header link that highlights itself while its route (or a sub-route) is active. */
export function NavLink({ href, exact = false, className, ...rest }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
        active
          ? "bg-secondary text-secondary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      {...rest}
    />
  );
}
