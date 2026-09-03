"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { buildDayModel } from "./day-model";
import { DayGrid } from "./day-grid";
import { DayList } from "./day-list";
import { BookingDialog, type SlotSelection } from "./booking-dialog";
import type { DayAvailability } from "@/modules/availability/types";

export function CalendarView({ day }: { day: DayAvailability }) {
  const t = useTranslations("calendar");
  const model = useMemo(() => buildDayModel(day), [day]);
  const [selection, setSelection] = useState<SlotSelection | null>(null);

  if (day.rooms.length === 0) return <p className="text-muted-foreground py-8 text-center">{t("noRooms")}</p>;
  if (model.closedAllDay) return <p className="text-muted-foreground py-8 text-center">{t("closedToday")}</p>;

  return (
    <>
      <div className="hidden md:block">
        <DayGrid model={model} timezone={day.timezone} onSelect={setSelection} />
      </div>
      <div className="md:hidden">
        <DayList model={model} timezone={day.timezone} onSelect={setSelection} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("legend")}: ✅ {t("free")} · ⛔ {t("busy")} · 🚫 {t("closed")} · ★ {t("mine")}
      </p>
      <BookingDialog
        model={model}
        siteId={day.siteId}
        siteName={day.siteName}
        timezone={day.timezone}
        isAdmin={day.isAdmin}
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </>
  );
}
