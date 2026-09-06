"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/time";

type Props = {
  date: string;
  today: string;
  minDate: string | null;
  maxDate: string | null;
  basePath: string;
  label: string;
};

export function DateNav({ date, today, minDate, maxDate, basePath, label }: Props) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const go = (d: string) => router.push(`${basePath}?date=${d}`);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => go(prev)}
        disabled={minDate !== null && prev < minDate}
        aria-label={t("prevDay")}
      >
        ‹
      </Button>
      <Button variant="outline" size="sm" onClick={() => go(today)}>
        {t("today")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => go(next)}
        disabled={maxDate !== null && next > maxDate}
        aria-label={t("nextDay")}
      >
        ›
      </Button>
      <Input
        type="date"
        value={date}
        min={minDate ?? undefined}
        max={maxDate ?? undefined}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="w-40"
        dir="ltr"
      />
      <span className="font-medium ms-2">{label}</span>
    </div>
  );
}
