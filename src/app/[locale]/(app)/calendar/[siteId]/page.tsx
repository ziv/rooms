import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireOnboarded } from "../../guards";
import { listAccessibleSites } from "@/modules/sites/service";
import { Shell } from "@/components/layout/shell";

export default async function CalendarPage({ params }: { params: Promise<{ locale: string; siteId: string }> }) {
  const { siteId } = await params;
  const actor = await requireOnboarded();
  const sites = await listAccessibleSites(actor);
  const site = sites.find((s) => s.id === siteId);
  if (!site) notFound();
  const t = await getTranslations("calendar");
  return (
    <Shell actor={actor} sites={sites} currentSiteId={siteId}>
      <h1 className="text-xl font-semibold mb-2">
        {t("title")} · {site.name}
      </h1>
      <p className="text-muted-foreground">{t("placeholder")}</p>
    </Shell>
  );
}
