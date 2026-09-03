"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createBookingAction, listApprovedMembersAction } from "@/app/[locale]/(app)/calendar/actions";
import { addMinutes, REGULAR_BOOKING_MINUTES } from "@/lib/time";
import { useSiteFormat } from "./format";
import type { DayModel, RoomModel } from "./day-model";

export type SlotSelection = { roomId: string; start: Date };

type Props = {
  model: DayModel;
  siteId: string;
  siteName: string;
  timezone: string;
  isAdmin: boolean;
  selection: SlotSelection | null;
  onClose: () => void;
};

export function BookingDialog({ selection, onClose, ...rest }: Props) {
  return (
    <Dialog open={selection !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {selection && (
          <BookingForm
            key={`${selection.roomId}-${selection.start.toISOString()}`}
            selection={selection}
            onClose={onClose}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({
  model,
  siteId,
  siteName,
  timezone,
  isAdmin,
  selection,
  onClose,
}: Omit<Props, "selection"> & { selection: SlotSelection }) {
  const t = useTranslations("booking");
  const tc = useTranslations("calendar");
  const ta = useTranslations("app");
  const fmt = useSiteFormat(timezone);
  const router = useRouter();
  const { run, pending } = useAction();
  const [start, setStart] = useState<string>(selection.start.toISOString());
  const [note, setNote] = useState("");
  const [forUserId, setForUserId] = useState<string>("");
  const [members, setMembers] = useState<{ userId: string; fullName: string | null; email: string }[]>([]);

  const room: RoomModel | undefined = useMemo(
    () => model.rooms.find((r) => r.roomId === selection.roomId),
    [model, selection],
  );
  const startOptions = useMemo(() => room?.freeRanges.flatMap((r) => r.starts) ?? [], [room]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    listApprovedMembersAction(siteId).then((r) => {
      if (alive && r.ok) setMembers(r.data);
    });
    return () => {
      alive = false;
    };
  }, [isAdmin, siteId]);

  const submit = () => {
    if (!room || !start) return;
    const id = crypto.randomUUID();
    run(
      () =>
        createBookingAction({
          id,
          siteId,
          roomId: room.roomId,
          startAt: start,
          note: note || null,
          forUserId: isAdmin && forUserId ? forUserId : undefined,
        }),
      {
        onSuccess: (b) => {
          toast.success(t("created"), {
            action: { label: t("addToCalendar"), onClick: () => window.open(`/api/bookings/${b.id}/ics`, "_blank") },
          });
          onClose();
          router.refresh();
        },
        onError: (r) => {
          if (r.code === "SLOT_TAKEN") {
            toast.error(t("slotTaken"));
            onClose();
            router.refresh();
            return true;
          }
          return false;
        },
      },
    );
  };

  const startItems = startOptions.map((d) => ({ value: d.toISOString(), label: fmt.time(d) }));
  const memberItems = members.map((m) => ({ value: m.userId, label: m.fullName ?? m.email }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
        <DialogDescription>
          {siteName} · {tc("room")} {room?.roomNumber} · {fmt.date(selection.start)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {isAdmin && (
          <div className="space-y-1.5">
            <Label htmlFor="forUser">{t("therapist")}</Label>
            <Select value={forUserId} onValueChange={(v) => setForUserId(v ?? "")} items={memberItems}>
              <SelectTrigger id="forUser">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memberItems.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start">{t("start")}</Label>
            <Select value={start} onValueChange={(v) => v && setStart(v)} items={startItems}>
              <SelectTrigger id="start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {startItems.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("end")}</Label>
            <div className="h-9 flex items-center text-sm">
              {start && fmt.time(addMinutes(new Date(start), REGULAR_BOOKING_MINUTES))}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">{t("note")}</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
          <p className="text-xs text-muted-foreground">{t("noteWarning")}</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          {ta("cancel")}
        </Button>
        <Button onClick={submit} disabled={pending || !start || (isAdmin && !forUserId)}>
          {t("confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
