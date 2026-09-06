"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import {
  cancelSeriesAction,
  deleteSeriesAction,
  previewSeriesAction,
  splitSeriesAction,
  updateSeriesAction,
} from "../actions";
import { PreviewPanel } from "../series-form";
import { useSiteFormat } from "@/components/calendar/format";
import { Link } from "@/i18n/navigation";
import type { SeriesPreview } from "@/modules/recurrence/service";

export type SeriesView = {
  id: string;
  siteId: string;
  siteName: string;
  timezone: string;
  roomId: string;
  roomNumber: string;
  userId: string;
  userName: string | null;
  weekday: number;
  intervalWeeks: number;
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
  status: "ACTIVE" | "ENDED" | "CANCELLED";
  occurrences: {
    id: string;
    startAt: string;
    endAt: string;
    status: "CONFIRMED" | "CANCELLED";
    isException: boolean;
    roomId: string;
  }[];
};

type Props = {
  series: SeriesView;
  rooms: { id: string; roomNumber: string }[];
  members: { userId: string; fullName: string | null; email: string }[];
  today: string;
  locale: string;
  defaultFromDate?: string;
};

export function SeriesDetail({ series, rooms, members, today, locale, defaultFromDate }: Props) {
  const t = useTranslations("admin.series");
  const tw = useTranslations("weekdays");
  const ta = useTranslations("app");
  const fmt = useSiteFormat(series.timezone);
  const router = useRouter();
  const { run, pending } = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(Boolean(defaultFromDate));
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const doDelete = () =>
    run(() => deleteSeriesAction({ seriesId: series.id }), {
      onSuccess: (r) => {
        toast.success(r.mode === "DELETED" ? t("deleted") : t("deletedCancelled", { count: r.cancelled }));
        setDeleteOpen(false);
        if (r.mode === "DELETED") router.push(`/${locale}/admin/series`);
        else router.refresh();
      },
    });

  const cancel = () =>
    run(() => cancelSeriesAction({ seriesId: series.id }), {
      onSuccess: () => {
        toast.success(t("cancelled"));
        setCancelOpen(false);
        router.refresh();
      },
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {series.userName} · {series.siteName} · {t("room")} {series.roomNumber}
          </CardTitle>
          <Badge variant={series.status === "ACTIVE" ? "default" : "secondary"}>{t(`status${series.status}`)}</Badge>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            {tw(String(series.weekday))} · {t(series.intervalWeeks === 2 ? "everyTwoWeeks" : "everyWeek")} ·{" "}
            <span dir="ltr">
              {series.startTime}–{series.endTime}
            </span>
          </div>
          <div dir="ltr" className="text-start">
            {series.startsOn} → {series.endsOn}
          </div>
          {series.note && <div className="text-muted-foreground">{series.note}</div>}
          <div className="flex flex-wrap gap-2 pt-3">
            {series.status === "ACTIVE" && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  {t("edit")}
                </Button>
                <Button variant="outline" onClick={() => setSplitOpen(true)}>
                  {t("split")}
                </Button>
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                  {t("cancel")}
                </Button>
              </>
            )}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              {t("delete")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="font-medium">
        {t("occurrences")} ({series.occurrences.length})
      </h2>
      <ul className="divide-y rounded-lg border bg-card">
        {series.occurrences.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 p-2 text-sm">
            <Link href={`/bookings/${o.id}`} className="underline-offset-2 hover:underline">
              {fmt.dateShort(o.startAt)} <span className="text-muted-foreground">{fmt.range(o.startAt, o.endAt)}</span>
              {o.roomId !== series.roomId && (
                <span className="text-muted-foreground">
                  {" "}
                  · {t("room")} {rooms.find((r) => r.id === o.roomId)?.roomNumber}
                </span>
              )}
            </Link>
            <span className="flex gap-1">
              {o.isException && <Badge variant="outline">{t("exception")}</Badge>}
              {o.status === "CANCELLED" && <Badge variant="secondary">{t("statusCANCELLED")}</Badge>}
            </span>
          </li>
        ))}
      </ul>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancel")}</DialogTitle>
            <DialogDescription>{t("cancelConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={pending}>
              {ta("back")}
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={pending}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteHint")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              {ta("back")}
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editOpen && (
        <EditDialog
          series={series}
          rooms={rooms}
          members={members}
          today={today}
          locale={locale}
          onClose={() => setEditOpen(false)}
        />
      )}
      {splitOpen && (
        <SplitDialog
          series={series}
          rooms={rooms}
          members={members}
          today={today}
          locale={locale}
          defaultFromDate={defaultFromDate}
          onClose={() => setSplitOpen(false)}
        />
      )}
    </div>
  );
}

function SplitDialog({
  series,
  rooms,
  members,
  today,
  locale,
  defaultFromDate,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useTranslations("admin.series");
  const tw = useTranslations("weekdays");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    fromDate: defaultFromDate ?? (today > series.startsOn ? today : series.startsOn),
    roomId: series.roomId,
    userId: series.userId,
    weekday: String(series.weekday),
    intervalWeeks: String(series.intervalWeeks),
    startTime: series.startTime,
    endTime: series.endTime,
    endsOn: series.endsOn,
  });
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setPreview(null);
  };
  const changes = () => ({
    roomId: form.roomId,
    userId: form.userId,
    weekday: Number(form.weekday),
    intervalWeeks: Number(form.intervalWeeks) === 2 ? (2 as const) : (1 as const),
    startTime: form.startTime,
    endTime: form.endTime,
    endsOn: form.endsOn,
  });
  const doPreview = () =>
    run(
      () =>
        previewSeriesAction({
          siteId: series.siteId,
          ...changes(),
          startsOn: form.fromDate,
          note: series.note,
          excludeSeriesId: series.id,
          // keep the biweekly phase of the old series (see splitSeries)
          anchorOn: series.intervalWeeks === 2 && form.intervalWeeks === "2" ? series.startsOn : undefined,
        }),
      { onSuccess: setPreview },
    );
  const apply = (skipConflicts: boolean) =>
    run(() => splitSeriesAction({ seriesId: series.id, fromDate: form.fromDate, changes: changes(), skipConflicts }), {
      onSuccess: (r) => {
        toast.success(t("splitDone"));
        router.push(`/${locale}/admin/series/${r.newSeriesId}`);
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("split")}</DialogTitle>
          <DialogDescription>{t("splitHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fromDate">{t("fromDate")}</Label>
              <Input
                id="fromDate"
                type="date"
                value={form.fromDate}
                min={today}
                max={series.endsOn}
                onChange={(e) => set({ fromDate: e.target.value })}
                dir="ltr"
              />
            </div>
            {sel(
              "sroom",
              t("room"),
              form.roomId,
              rooms.map((r) => ({ value: r.id, label: `${t("room")} ${r.roomNumber}` })),
              (v) => set({ roomId: v }),
            )}
            {sel(
              "suser",
              t("therapist"),
              form.userId,
              members.map((m) => ({ value: m.userId, label: m.fullName ?? m.email })),
              (v) => set({ userId: v }),
            )}
            {sel(
              "sweekday",
              t("weekday"),
              form.weekday,
              [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: tw(String(d)) })),
              (v) => set({ weekday: v }),
            )}
            {sel(
              "sfrequency",
              t("frequency"),
              form.intervalWeeks,
              [
                { value: "1", label: t("everyWeek") },
                { value: "2", label: t("everyTwoWeeks") },
              ],
              (v) => set({ intervalWeeks: v }),
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sst">{t("startTime")}</Label>
                <Input
                  id="sst"
                  type="time"
                  step={900}
                  value={form.startTime}
                  onChange={(e) => set({ startTime: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set">{t("endTime")}</Label>
                <Input
                  id="set"
                  type="time"
                  step={900}
                  value={form.endTime}
                  onChange={(e) => set({ endTime: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo">{t("endsOn")}</Label>
              <Input
                id="seo"
                type="date"
                value={form.endsOn}
                onChange={(e) => set({ endsOn: e.target.value })}
                dir="ltr"
              />
            </div>
            <Button variant="outline" onClick={doPreview} disabled={pending || !form.fromDate}>
              {t("preview")}
            </Button>
          </div>
          <div>
            {preview && (
              <PreviewPanel preview={preview} timezone={series.timezone} pending={pending} onCreate={apply} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {ta("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ series, rooms, members, locale, onClose }: Props & { onClose: () => void }) {
  const t = useTranslations("admin.series");
  const tw = useTranslations("weekdays");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    roomId: series.roomId,
    userId: series.userId,
    weekday: String(series.weekday),
    intervalWeeks: String(series.intervalWeeks),
    startTime: series.startTime,
    endTime: series.endTime,
    startsOn: series.startsOn,
    endsOn: series.endsOn,
    note: series.note ?? "",
  });
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setPreview(null);
  };
  const input = () => ({
    siteId: series.siteId,
    roomId: form.roomId,
    userId: form.userId,
    weekday: Number(form.weekday),
    intervalWeeks: Number(form.intervalWeeks) === 2 ? (2 as const) : (1 as const),
    startTime: form.startTime,
    endTime: form.endTime,
    startsOn: form.startsOn,
    endsOn: form.endsOn,
    note: form.note || null,
  });
  const doPreview = () =>
    run(() => previewSeriesAction({ ...input(), excludeSeriesId: series.id }), { onSuccess: setPreview });
  const save = (skipConflicts: boolean) =>
    run(() => updateSeriesAction({ ...input(), seriesId: series.id, skipConflicts }), {
      onSuccess: () => {
        toast.success(t("updated"));
        onClose();
        router.refresh();
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
  void locale;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {sel(
              "eroom",
              t("room"),
              form.roomId,
              rooms.map((r) => ({ value: r.id, label: `${t("room")} ${r.roomNumber}` })),
              (v) => set({ roomId: v }),
            )}
            {sel(
              "euser",
              t("therapist"),
              form.userId,
              members.map((m) => ({ value: m.userId, label: m.fullName ?? m.email })),
              (v) => set({ userId: v }),
            )}
            {sel(
              "eweekday",
              t("weekday"),
              form.weekday,
              [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: tw(String(d)) })),
              (v) => set({ weekday: v }),
            )}
            {sel(
              "efrequency",
              t("frequency"),
              form.intervalWeeks,
              [
                { value: "1", label: t("everyWeek") },
                { value: "2", label: t("everyTwoWeeks") },
              ],
              (v) => set({ intervalWeeks: v }),
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="est">{t("startTime")}</Label>
                <Input
                  id="est"
                  type="time"
                  step={900}
                  value={form.startTime}
                  onChange={(e) => set({ startTime: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eet">{t("endTime")}</Label>
                <Input
                  id="eet"
                  type="time"
                  step={900}
                  value={form.endTime}
                  onChange={(e) => set({ endTime: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eso">{t("startsOn")}</Label>
                <Input
                  id="eso"
                  type="date"
                  value={form.startsOn}
                  onChange={(e) => set({ startsOn: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eeo">{t("endsOn")}</Label>
                <Input
                  id="eeo"
                  type="date"
                  value={form.endsOn}
                  onChange={(e) => set({ endsOn: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enote">{t("note")}</Label>
              <Input id="enote" value={form.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} />
            </div>
            <Button variant="outline" onClick={doPreview} disabled={pending}>
              {t("preview")}
            </Button>
          </div>
          <div>
            {preview && (
              <PreviewPanel
                preview={preview}
                timezone={series.timezone}
                pending={pending}
                onCreate={save}
                createLabel={t("save")}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {ta("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
