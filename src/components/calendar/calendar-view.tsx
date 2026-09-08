"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDayModel } from "./day-model";
import { DayGrid } from "./day-grid";
import { DayList } from "./day-list";
import { BookingDialog, type SlotSelection } from "./booking-dialog";
import type { DayAvailability } from "@/modules/availability/types";

type MobileView = "list" | "grid";
const MOBILE_VIEW_KEY = "calendar.mobileView";
const mobileViewListeners = new Set<() => void>();
const readMobileView = (): MobileView => {
  try {
    return localStorage.getItem(MOBILE_VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
};
const writeMobileView = (v: MobileView) => {
  try {
    localStorage.setItem(MOBILE_VIEW_KEY, v);
  } catch {}
  mobileViewListeners.forEach((l) => l());
};
const subscribeMobileView = (l: () => void) => {
  mobileViewListeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    mobileViewListeners.delete(l);
    window.removeEventListener("storage", l);
  };
};

export function CalendarView({ day }: { day: DayAvailability }) {
  const t = useTranslations("calendar");
  const model = useMemo(() => buildDayModel(day), [day]);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  // Managers can switch the phone view between "one room at a time" and the all-rooms grid
  // (remembered per device; the server renders "list" and the stored choice applies after hydration).
  const mobileView = useSyncExternalStore(subscribeMobileView, readMobileView, () => "list" as MobileView);
  const chooseMobileView = writeMobileView;

  if (day.rooms.length === 0) return <p className="text-muted-foreground py-8 text-center">{t("noRooms")}</p>;
  if (model.closedAllDay) return <p className="text-muted-foreground py-8 text-center">{t("closedToday")}</p>;

  return (
    <>
      <div className="hidden md:block">
        <DayGrid model={model} timezone={day.timezone} onSelect={setSelection} />
      </div>
      <div className="md:hidden">
        {day.isAdmin && (
          <div className="mb-3 flex justify-end gap-1" role="group" aria-label={t("view")}>
            <Button
              size="sm"
              variant={mobileView === "list" ? "default" : "outline"}
              aria-pressed={mobileView === "list"}
              onClick={() => chooseMobileView("list")}
            >
              <List aria-hidden />
              {t("viewByRoom")}
            </Button>
            <Button
              size="sm"
              variant={mobileView === "grid" ? "default" : "outline"}
              aria-pressed={mobileView === "grid"}
              onClick={() => chooseMobileView("grid")}
            >
              <LayoutGrid aria-hidden />
              {t("viewAllRooms")}
            </Button>
          </div>
        )}
        {day.isAdmin && mobileView === "grid" ? (
          <DayGrid model={model} timezone={day.timezone} onSelect={setSelection} dense />
        ) : (
          <DayList model={model} timezone={day.timezone} onSelect={setSelection} />
        )}
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
