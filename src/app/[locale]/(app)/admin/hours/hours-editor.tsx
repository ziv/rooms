"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "@/hooks/use-action";
import { setOpeningHoursAction } from "./actions";
import type { Segment } from "@/lib/validation/opening-hours";

type Props = { siteId: string; hours: Record<number, Segment[]> };

export function HoursEditor({ siteId, hours }: Props) {
  const t = useTranslations("admin.hours");
  const tw = useTranslations("weekdays");
  const ta = useTranslations("app");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
        <DayCard key={wd} siteId={siteId} weekday={wd} initial={hours[wd] ?? []} label={tw(String(wd))} t={t} ta={ta} />
      ))}
    </div>
  );
}

function DayCard({
  siteId,
  weekday,
  initial,
  label,
  t,
  ta,
}: {
  siteId: string;
  weekday: number;
  initial: Segment[];
  label: string;
  t: ReturnType<typeof useTranslations<"admin.hours">>;
  ta: ReturnType<typeof useTranslations<"app">>;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [segments, setSegments] = useState<Segment[]>(initial);
  const dirty = JSON.stringify(segments) !== JSON.stringify(initial);

  const update = (i: number, patch: Partial<Segment>) =>
    setSegments(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const save = () =>
    run(() => setOpeningHoursAction({ siteId, weekday, segments }), {
      onSuccess: ({ warnings }) => {
        if (warnings.length)
          toast.warning(t("warnings", { count: warnings.length }), {
            description: warnings
              .map((w) => `${w.roomNumber}: ${w.startAt.slice(0, 16)} ${w.userName ?? ""}`)
              .join("\n"),
          });
        else toast.success(ta("saved"));
        router.refresh();
      },
      onError: (r) => {
        if (r.code === "VALIDATION") {
          toast.error(t("invalid"));
          return true;
        }
        return false;
      },
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{label}</CardTitle>
        {segments.length === 0 && <span className="text-sm text-muted-foreground">{t("closedDay")}</span>}
      </CardHeader>
      <CardContent className="space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="time"
              step={900}
              value={s.start}
              onChange={(e) => update(i, { start: e.target.value })}
              className="w-32"
              aria-label={t("from")}
              dir="ltr"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              step={900}
              value={s.end}
              onChange={(e) => update(i, { end: e.target.value })}
              className="w-32"
              aria-label={t("to")}
              dir="ltr"
            />
            <Button variant="ghost" size="sm" onClick={() => setSegments(segments.filter((_, j) => j !== i))}>
              {t("remove")}
            </Button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSegments([...segments, { start: segments.at(-1)?.end ?? "08:00", end: "21:00" }])}
          >
            {t("addSegment")}
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            {ta("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
