import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireOnboarded } from "../../guards";
import { listAccessibleSites } from "@/modules/sites/service";
import { getDayAvailability } from "@/modules/availability/service";
import { Shell } from "@/components/layout/shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { DateNav } from "@/components/calendar/date-nav";
import { dayBounds, todayLocal } from "@/lib/time";
import { isAdmin } from "@/modules/auth/actor";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; siteId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale, siteId } = await params;
  const { date: dateParam } = await searchParams;
  const actor = await requireOnboarded();
  const sites = await listAccessibleSites(actor);
  const site = sites.find((s) => s.id === siteId);
  if (!site) notFound();

  const today = todayLocal(site.timezone);
  const admin = isAdmin(actor);
  const minDate = admin ? null : today;
  let date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  if (minDate && date < minDate) date = minDate;

  const day = await getDayAvailability(actor, { siteId, date });
  const t = await getTranslations("calendar");
  const f = await getFormatter();
  const label = f.dateTime(dayBounds(date, site.timezone).start, { dateStyle: "full", timeZone: site.timezone });

  return (
    <Shell actor={actor} sites={sites} currentSiteId={siteId}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">
          {t("title")} · {site.name}
        </h1>
        <DateNav
          date={date}
          today={today}
          minDate={minDate}
          maxDate={null}
          basePath={`/${locale}/calendar/${siteId}`}
          label={label}
        />
      </div>
      <CalendarView day={day} />
    </Shell>
  );
}
