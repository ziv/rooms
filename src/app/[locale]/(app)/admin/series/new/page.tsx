import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../../guards";
import { AdminShell } from "../../admin-shell";
import { listAccessibleSites } from "@/modules/sites/service";
import { listRooms } from "@/modules/rooms/service";
import { listApprovedMembers } from "@/modules/memberships/service";
import { SeriesForm, type SiteOption } from "../series-form";

export default async function NewSeriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const actor = await requireAdminPage();
  const sites = await listAccessibleSites(actor);
  const options: SiteOption[] = await Promise.all(
    sites.map(async (s) => ({
      id: s.id,
      name: s.name,
      timezone: s.timezone,
      rooms: (await listRooms(actor, s.id)).map((r) => ({ id: r.id, roomNumber: r.roomNumber })),
      members: await listApprovedMembers(actor, s.id),
    })),
  );
  const t = await getTranslations("admin.series");
  return (
    <AdminShell actor={actor}>
      <h1 className="text-xl font-semibold mb-4">{t("new")}</h1>
      <SeriesForm sites={options} locale={locale} />
    </AdminShell>
  );
}
