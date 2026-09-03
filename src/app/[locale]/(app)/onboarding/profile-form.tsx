"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { updateProfileAction } from "./actions";
import { LOCALES, type Locale } from "@/i18n/routing";

type Props = { defaultLocale: Locale; defaultName?: string; submitLabel?: string; afterSave?: "calendar" | "stay" };

export function ProfileForm({ defaultLocale, defaultName = "", submitLabel, afterSave = "calendar" }: Props) {
  const t = useTranslations("onboarding");
  const tl = useTranslations("locale");
  const tp = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [fullName, setFullName] = useState(defaultName);
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => updateProfileAction({ fullName, locale }), {
      onSuccess: () => {
        if (afterSave === "calendar") router.replace(`/${locale}/onboarding`);
        else router.replace(`/${locale}/profile`);
        router.refresh();
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="locale">{t("language")}</Label>
        <Select
          value={locale}
          onValueChange={(v) => v && setLocale(v as Locale)}
          items={LOCALES.map((l) => ({ value: l, label: tl(l) }))}
        >
          <SelectTrigger id="locale">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((l) => (
              <SelectItem key={l} value={l}>
                {tl(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {submitLabel ?? (afterSave === "calendar" ? t("continue") : tp("save"))}
      </Button>
    </form>
  );
}
