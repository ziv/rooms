"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { sites: { id: string; name: string }[]; currentSiteId?: string };

export function SiteSwitcher({ sites, currentSiteId }: Props) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const value = currentSiteId ?? sites[0]?.id;

  const onChange = (siteId: string | null) => {
    if (!siteId) return;
    // Replace the site segment where present, otherwise go to the site calendar.
    const replaced = pathname.replace(/\/(calendar)\/[^/]+/, `/$1/${siteId}`);
    router.push(replaced === pathname ? `/calendar/${siteId}` : replaced);
  };

  return (
    <Select value={value} onValueChange={onChange} items={sites.map((s) => ({ value: s.id, label: s.name }))}>
      <SelectTrigger className="w-44" aria-label={t("site")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
