import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listAccessibleSites } from "@/modules/sites/service";
import { listRooms } from "@/modules/rooms/service";
import { listClosures } from "@/modules/closures/service";
import { ClosuresManager } from "./closures-manager";
import { Link } from "@/i18n/navigation";

export default async function ClosuresPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const actor = await requireAdminPage();
  const { site: siteParam } = await searchParams;
  const sites = await listAccessibleSites(actor);
  const site = sites.find((s) => s.id === siteParam) ?? sites[0];
  const t = await getTranslations("admin.closures");
  const [rooms, closures] = site
    ? await Promise.all([listRooms(actor, site.id), listClosures(actor, site.id, { from: new Date() })])
    : [[], []];

  return (
    <AdminShell actor={actor} currentSiteId={site?.id}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <nav className="flex gap-3 text-sm">
          {sites.map((s) => (
            <Link
              key={s.id}
              href={{ pathname: "/admin/closures", query: { site: s.id } }}
              className={s.id === site?.id ? "font-semibold underline" : ""}
            >
              {s.name}
            </Link>
          ))}
        </nav>
      </div>
      {site && (
        <ClosuresManager key={site.id} siteId={site.id} timezone={site.timezone} rooms={rooms} closures={closures} />
      )}
    </AdminShell>
  );
}
