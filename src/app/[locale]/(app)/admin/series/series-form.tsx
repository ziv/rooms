"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/hooks/use-action";
import { createSeriesAction, previewSeriesAction } from "./actions";
import type { SeriesPreview } from "@/modules/recurrence/service";
import { useSiteFormat } from "@/components/calendar/format";

export type SiteOption = {
  id: string;
  name: string;
  timezone: string;
  rooms: { id: string; roomNumber: string }[];
  members: { userId: string; fullName: string | null; email: string }[];
};

export function SeriesForm({ sites, locale }: { sites: SiteOption[]; locale: string }) {
  const t = useTranslations("admin.series");
  const tw = useTranslations("weekdays");
  const router = useRouter();
  const { run, pending } = useAction();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  const [form, setForm] = useState({
    roomId: site?.rooms[0]?.id ?? "",
    userId: "",
    weekday: "0",
    startTime: "09:00",
    endTime: "12:00",
    startsOn: "",
    endsOn: "",
    note: "",
  });
  const [preview, setPreview] = useState<SeriesPreview | null>(null);

  const input = () => ({
    siteId,
    roomId: form.roomId,
    userId: form.userId,
    weekday: Number(form.weekday),
    startTime: form.startTime,
    endTime: form.endTime,
    startsOn: form.startsOn,
    endsOn: form.endsOn,
    note: form.note || null,
  });
  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setPreview(null);
  };

  const doPreview = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => previewSeriesAction(input()), { onSuccess: setPreview });
  };
  const create = (skipConflicts: boolean) =>
    run(() => createSeriesAction({ ...input(), skipConflicts }), {
      onSuccess: (r) => {
        toast.success(t("created", { count: r.created }));
        router.push(`/${locale}/admin/series/${r.id}`);
      },
    });

  const sel = (
    id: string,
    label: string,
    value: string,
    items: { value: string; label: string }[],
    onChange: (v: string) => void,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)} items={items}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={doPreview} className="space-y-3">
            {sel(
              "site",
              t("site"),
              siteId,
              sites.map((s) => ({ value: s.id, label: s.name })),
              (v) => {
                setSiteId(v);
                const s = sites.find((x) => x.id === v)!;
                set({ roomId: s.rooms[0]?.id ?? "", userId: "" });
              },
            )}
            {sel(
              "room",
              t("room"),
              form.roomId,
              site?.rooms.map((r) => ({ value: r.id, label: `${t("room")} ${r.roomNumber}` })) ?? [],
              (v) => set({ roomId: v }),
            )}
            {sel(
              "user",
              t("therapist"),
              form.userId,
              site?.members.map((m) => ({ value: m.userId, label: m.fullName ?? m.email })) ?? [],
              (v) => set({ userId: v }),
            )}
            {sel(
              "weekday",
              t("weekday"),
              form.weekday,
              [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: tw(String(d)) })),
              (v) => set({ weekday: v }),
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st">{t("startTime")}</Label>
                <Input
                  id="st"
                  type="time"
                  step={900}
                  value={form.startTime}
                  onChange={(e) => set({ startTime: e.target.value })}
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et">{t("endTime")}</Label>
                <Input
                  id="et"
                  type="time"
                  step={900}
                  value={form.endTime}
                  onChange={(e) => set({ endTime: e.target.value })}
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="so">{t("startsOn")}</Label>
                <Input
                  id="so"
                  type="date"
                  value={form.startsOn}
                  onChange={(e) => set({ startsOn: e.target.value, endsOn: form.endsOn || e.target.value })}
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eo">{t("endsOn")}</Label>
                <Input
                  id="eo"
                  type="date"
                  value={form.endsOn}
                  onChange={(e) => set({ endsOn: e.target.value })}
                  dir="ltr"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">{t("note")}</Label>
              <Textarea
                id="note"
                rows={2}
                maxLength={300}
                value={form.note}
                onChange={(e) => set({ note: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={pending || !form.userId || !form.roomId}>
              {t("preview")}
            </Button>
          </form>
        </CardContent>
      </Card>
      {preview && site && (
        <PreviewPanel preview={preview} timezone={site.timezone} pending={pending} onCreate={create} />
      )}
    </div>
  );
}

export function PreviewPanel({
  preview,
  timezone,
  pending,
  onCreate,
}: {
  preview: SeriesPreview;
  timezone: string;
  pending: boolean;
  onCreate: (skip: boolean) => void;
}) {
  const t = useTranslations("admin.series");
  const fmt = useSiteFormat(timezone);
  const total = preview.occurrences.length;
  return (
    <div className="space-y-3">
      <p className="font-medium">
        {preview.conflictCount ? t("conflicts", { count: preview.conflictCount, total }) : t("noConflicts", { total })}
      </p>
      <ul className="divide-y rounded-lg border bg-card max-h-[420px] overflow-y-auto">
        {preview.occurrences.map((o) => (
          <li key={o.date} className="flex items-center justify-between gap-3 p-2 text-sm">
            <span>
              {o.start ? fmt.dateShort(o.start) : o.date}{" "}
              {o.start && o.end && <span className="text-muted-foreground">{fmt.range(o.start, o.end)}</span>}
            </span>
            {o.conflict ? (
              <Badge variant="destructive">
                {t(`conflict.${o.conflict.code}`)}
                {o.conflict.with?.userName ? ` · ${o.conflict.with.userName}` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary">{t("free")}</Badge>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {preview.conflictCount === 0 ? (
          <Button onClick={() => onCreate(false)} disabled={pending}>
            {t("create")}
          </Button>
        ) : (
          <Button onClick={() => onCreate(true)} disabled={pending || preview.freeCount === 0}>
            {t("createFree", { count: preview.freeCount })}
          </Button>
        )}
      </div>
    </div>
  );
}
