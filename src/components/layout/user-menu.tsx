"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/[locale]/(app)/actions";
import type { Actor } from "@/modules/auth/actor";
import { LOCALES } from "@/i18n/routing";

export function UserMenu({ actor, admin }: { actor: Pick<Actor, "email" | "fullName">; admin: boolean }) {
  const t = useTranslations("nav");
  const tl = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="max-w-48 truncate" />}>
        {actor.fullName ?? actor.email}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground" dir="ltr">
          {actor.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>{t("profile")}</DropdownMenuItem>
        {admin && <DropdownMenuItem render={<Link href="/admin/dashboard" />}>{t("admin")}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">{t("language")}</DropdownMenuLabel>
        {LOCALES.filter((l) => l !== locale).map((l) => (
          <DropdownMenuItem key={l} onSelect={() => router.replace(pathname, { locale: l })}>
            {tl(l)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOutAction()}>{t("signOut")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
