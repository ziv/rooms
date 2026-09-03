"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { cancelBookingAction, getAvailabilityAction, moveBookingAction } from "@/app/[locale]/(app)/calendar/actions";
import { buildDayModel } from "@/components/calendar/day-model";
import { useSiteFormat } from "@/components/calendar/format";
import { Link } from "@/i18n/navigation";
import type { DayAvailability } from "@/modules/availability/types";

export type BookingView = {
  id: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  timezone: string;
  roomId: string;
  roomNumber: string;
  userName: string | null;
  startAt: string;
  endAt: string;
  localDate: string;
  bookingType: "REGULAR" | "SERIES";
  status: "CONFIRMED" | "CANCELLED";
  note: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  seriesId: string | null;
};

type Props = {
  booking: BookingView;
  rooms: { id: string; roomNumber: string }[];
  canMove: boolean;
  canCancel: boolean;
  isAdmin: boolean;
};

export function BookingDetail({ booking, rooms, canMove, canCancel, isAdmin }: Props) {
  const t = useTranslations("booking");
  const tc = useTranslations("calendar");
  const ta = useTranslations("app");
  const ts = useTranslations("admin.series");
  const fmt = useSiteFormat(booking.timezone);
  const router = useRouter();
  const { run, pending } = useAction();
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const cancel = () =>
    run(() => cancelBookingAction({ bookingId: booking.id, reason: reason || undefined }), {
      onSuccess: () => {
        toast.success(t("cancelled"));
        setCancelOpen(false);
        router.refresh();
      },
    });

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          <Row label={t("date")} value={fmt.date(booking.startAt)} />
          <Row label={t("start")} value={fmt.range(booking.startAt, booking.endAt)} />
          <Row label={t("site")} value={`${booking.siteName} · ${booking.siteAddress}`} />
          <Row label={t("room")} value={`${tc("room")} ${booking.roomNumber}`} />
          {isAdmin && <Row label={t("therapist")} value={booking.userName ?? ""} />}
          <Row label={t("type")} value={t(`type${booking.bookingType}`)} />
          <Row
            label={t("status")}
            value={
              <Badge variant={booking.status === "CONFIRMED" ? "default" : "secondary"}>
                {t(`status${booking.status}`)}
              </Badge>
            }
          />
          {booking.note && <Row label={t("note")} value={booking.note} />}
          {booking.status === "CANCELLED" && booking.cancellationReason && (
            <Row label={t("cancelReason")} value={booking.cancellationReason} />
          )}
          {booking.bookingType === "SERIES" && !isAdmin && (
            <p className="text-xs text-muted-foreground pt-2">{t("seriesNote")}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {booking.status === "CONFIRMED" && (
          <Button variant="outline" nativeButton={false} render={<a href={`/api/bookings/${booking.id}/ics`} />}>
            {t("addToCalendar")}
          </Button>
        )}
        {canMove && (
          <Button variant="outline" onClick={() => setMoveOpen(true)}>
            {t("move")}
          </Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setCancelOpen(true)}>
            {t("cancel")}
          </Button>
        )}
        {isAdmin && booking.seriesId && booking.status === "CONFIRMED" && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/admin/series/${booking.seriesId}?from=${booking.localDate}`} />}
          >
            {ts("thisAndFollowing")}
          </Button>
        )}
        {isAdmin && booking.seriesId && (
          <Button variant="ghost" nativeButton={false} render={<Link href={`/admin/series/${booking.seriesId}`} />}>
            {ts("seriesLink")}
          </Button>
        )}
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/calendar/${booking.siteId}?date=${booking.localDate}`} />}
        >
          {t("backToCalendar")}
        </Button>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelConfirm")}</DialogTitle>
            <DialogDescription>
              {fmt.date(booking.startAt)} · {fmt.time(booking.startAt)} · {tc("room")} {booking.roomNumber}
            </DialogDescription>
          </DialogHeader>
          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="reason">{t("cancelReason")}</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            </div>
          )}
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

      {moveOpen && <MoveDialog booking={booking} rooms={rooms} onClose={() => setMoveOpen(false)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MoveDialog({
  booking,
  rooms,
  onClose,
}: {
  booking: BookingView;
  rooms: { id: string; roomNumber: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("calendar");
  const ta = useTranslations("app");
  const fmt = useSiteFormat(booking.timezone);
  const router = useRouter();
  const { run, pending } = useAction();
  const [date, setDate] = useState(booking.localDate);
  const [roomId, setRoomId] = useState(booking.roomId);
  const [start, setStart] = useState<string>("");
  const [loaded, setLoaded] = useState<{ date: string; day: DayAvailability } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const day = loaded?.date === date ? loaded.day : null;

  useEffect(() => {
    let alive = true;
    getAvailabilityAction({ siteId: booking.siteId, date }).then((r) => {
      if (alive && r.ok) setLoaded({ date, day: r.data });
    });
    return () => {
      alive = false;
    };
  }, [booking.siteId, date, reloadKey]);

  // Exclude this booking's own block so its current slot counts as free.
  const model = useMemo(() => {
    if (!day) return null;
    const filtered: DayAvailability = {
      ...day,
      rooms: day.rooms.map((r) => ({
        ...r,
        blocks: r.blocks.filter((b) => !("bookingId" in b) || b.bookingId !== booking.id),
      })),
    };
    return buildDayModel(filtered);
  }, [day, booking.id]);
  const room = model?.rooms.find((r) => r.roomId === roomId);
  const starts = room?.freeRanges.flatMap((r) => r.starts) ?? [];
  const startItems = starts.map((d) => ({ value: d.toISOString(), label: fmt.time(d) }));
  const roomItems = rooms.map((r) => ({ value: r.id, label: `${tc("room")} ${r.roomNumber}` }));

  const submit = () =>
    run(() => moveBookingAction({ bookingId: booking.id, roomId, startAt: start }), {
      onSuccess: () => {
        toast.success(t("moved"));
        onClose();
        router.refresh();
      },
      onError: (r) => {
        if (r.code === "SLOT_TAKEN") {
          toast.error(t("slotTaken"));
          setStart("");
          setLoaded(null);
          setReloadKey((k) => k + 1);
          return true;
        }
        return false;
      },
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("moveTitle")}</DialogTitle>
          <DialogDescription>{t("moveHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mdate">{t("date")}</Label>
            <Input
              id="mdate"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mroom">{t("room")}</Label>
            <Select value={roomId} onValueChange={(v) => v && setRoomId(v)} items={roomItems}>
              <SelectTrigger id="mroom">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roomItems.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mstart">{t("start")}</Label>
            {model === null ? (
              <p className="text-sm text-muted-foreground">{ta("loading")}</p>
            ) : startItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noSlots")}</p>
            ) : (
              <Select value={start} onValueChange={(v) => setStart(v ?? "")} items={startItems}>
                <SelectTrigger id="mstart">
                  <SelectValue placeholder={tc("pickTime")} />
                </SelectTrigger>
                <SelectContent>
                  {startItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {ta("cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || !start}>
            {ta("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
