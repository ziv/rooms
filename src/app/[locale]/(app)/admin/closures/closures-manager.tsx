"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { createClosureAction, deleteClosureAction } from "./actions";
import { localToUtc } from "@/lib/time";
import type { ConflictRow, ClosureRow } from "@/modules/closures/service";

type Props = { siteId: string; timezone: string; rooms: { id: string; roomNumber: string }[]; closures: ClosureRow[] };
type ConflictDto = Omit<ConflictRow, "startAt" | "endAt"> & { startAt: string; endAt: string };

export function ClosuresManager({ siteId, timezone, rooms, closures }: Props) {
  const t = useTranslations("admin.closures");
  const ta = useTranslations("app");
  const f = useFormatter();
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    roomId: "ALL",
    startDate: "",
    startTime: "08:00",
    endDate: "",
    endTime: "21:00",
    reason: "",
  });
  const [conflicts, setConflicts] = useState<ConflictDto[] | null>(null);
  const [cancelAll, setCancelAll] = useState(false);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const startAt = form.startDate && localToUtc(form.startDate, form.startTime, timezone);
    const endAt = form.endDate && localToUtc(form.endDate, form.endTime, timezone);
    if (!startAt || !endAt || startAt >= endAt) {
      toast.error(t("invalidRange"));
      return;
    }
    run(
      () =>
        createClosureAction({
          siteId,
          roomId: form.roomId === "ALL" ? null : form.roomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          reason: form.reason || undefined,
          cancelConflicts: cancelAll,
        }),
      {
        onSuccess: () => {
          toast.success(t("created"));
          setConflicts(null);
          setCancelAll(false);
          setForm({ ...form, reason: "" });
          router.refresh();
        },
        onError: (r) => {
          if (r.code === "CONFLICTS") {
            setConflicts((r.details as { conflicts: ConflictDto[] }).conflicts);
            return true;
          }
          return false;
        },
      },
    );
  };

  const fmt = (d: Date | string) =>
    f.dateTime(new Date(d), { dateStyle: "short", timeStyle: "short", timeZone: timezone });
  const roomItems = [
    { value: "ALL", label: t("wholeSite") },
    ...rooms.map((r) => ({ value: r.id, label: `${t("room")} ${r.roomNumber}` })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("add")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="room">{t("room")}</Label>
              <Select value={form.roomId} onValueChange={(v) => v && setForm({ ...form, roomId: v })} items={roomItems}>
                <SelectTrigger id="room">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roomItems.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="sd">{t("start")}</Label>
                <Input
                  id="sd"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value, endDate: form.endDate || e.target.value })
                  }
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st" className="sr-only">
                  {t("start")}
                </Label>
                <Input
                  id="st"
                  type="time"
                  step={900}
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ed">{t("end")}</Label>
                <Input
                  id="ed"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et" className="sr-only">
                  {t("end")}
                </Label>
                <Input
                  id="et"
                  type="time"
                  step={900}
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">{t("reason")}</Label>
              <Input
                id="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                maxLength={200}
              />
            </div>
            {conflicts && (
              <Alert variant="destructive">
                <AlertTitle>{t("conflictsTitle", { count: conflicts.length })}</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-sm">
                    {conflicts.map((c) => (
                      <li key={c.bookingId}>
                        {t("room")} {c.roomNumber} · {fmt(c.startAt)} · {c.userName ?? c.userId}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <Checkbox checked={cancelAll} onCheckedChange={(v) => setCancelAll(v === true)} />
                    {t("cancelAll")}
                  </label>
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              disabled={pending || (conflicts !== null && !cancelAll)}
              variant={conflicts && cancelAll ? "destructive" : "default"}
            >
              {conflicts && cancelAll ? t("confirmCancelAll") : t("create")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        {closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("room")}</TableHead>
                <TableHead>{t("start")}</TableHead>
                <TableHead>{t("end")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.roomNumber ?? t("wholeSite")}</TableCell>
                  <TableCell>{fmt(c.startAt)}</TableCell>
                  <TableCell>{fmt(c.endAt)}</TableCell>
                  <TableCell>{c.reason}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => deleteClosureAction({ closureId: c.id }), { onSuccess: () => router.refresh() })
                      }
                    >
                      {t("delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="sr-only">{ta("actions")}</p>
      </div>
    </div>
  );
}
