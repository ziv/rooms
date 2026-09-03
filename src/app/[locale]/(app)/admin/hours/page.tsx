import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listAccessibleSites } from "@/modules/sites/service";
import { getOpeningHours } from "@/modules/opening-hours/service";
import { HoursEditor } from "./hours-editor";
import { Link } from "@/i18n/navigation";
import type { Segment } from "@/lib/validation/opening-hours";

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const actor = await requireAdminPage();
  const { site: siteParam } = await searchParams;
  const sites = await listAccessibleSites(actor);
  const site = sites.find((s) => s.id === siteParam) ?? sites[0];
  const t = await getTranslations("admin.hours");
  const rows = site ? await getOpeningHours(actor, site.id) : [];
  const hours: Record<number, Segment[]> = {};
  for (const r of rows) (hours[r.weekday] ??= []).push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });

  return (
    <AdminShell actor={actor} currentSiteId={site?.id}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <nav className="flex gap-3 text-sm">
          {sites.map((s) => (
            <Link
              key={s.id}
              href={{ pathname: "/admin/hours", query: { site: s.id } }}
              className={s.id === site?.id ? "font-semibold underline" : ""}
            >
              {s.name}
            </Link>
          ))}
        </nav>
      </div>
      {site && <HoursEditor key={site.id} siteId={site.id} hours={hours} />}
    </AdminShell>
  );
}
