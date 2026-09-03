import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listAccessibleSites } from "@/modules/sites/service";
import { SiteForm } from "./site-form";

export default async function SettingsPage() {
  const actor = await requireAdminPage();
  const sites = await listAccessibleSites(actor);
  const t = await getTranslations("admin.settings");
  return (
    <AdminShell actor={actor}>
      <h1 className="text-xl font-semibold mb-4">{t("title")}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        {sites.map((s) => (
          <SiteForm key={s.id} site={s} />
        ))}
      </div>
    </AdminShell>
  );
}
