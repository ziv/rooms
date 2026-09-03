import { getTranslations } from "next-intl/server";
import { requireSession } from "../guards";
import { listAccessibleSites, listActiveSites } from "@/modules/sites/service";
import { Shell } from "@/components/layout/shell";
import { ProfileForm } from "../onboarding/profile-form";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

export default async function ProfilePage() {
  const actor = await requireSession();
  const [sites, allSites] = await Promise.all([listAccessibleSites(actor), listActiveSites()]);
  const t = await getTranslations("profile");
  const to = await getTranslations("onboarding");
  const statusBySite = new Map(actor.memberships.map((m) => [m.siteId, m.status]));

  return (
    <Shell actor={actor} sites={sites}>
      <div className="max-w-md space-y-8">
        <div>
          <h1 className="text-xl font-semibold mb-4">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {t("email")}: <span dir="ltr">{actor.email}</span>
          </p>
          <ProfileForm defaultLocale={actor.locale} defaultName={actor.fullName ?? ""} afterSave="stay" />
        </div>
        <div className="space-y-2">
          <h2 className="font-medium">{t("memberships")}</h2>
          <ul className="space-y-1 text-sm">
            {allSites.map((s) => {
              const st = statusBySite.get(s.id) ?? "NONE";
              return (
                <li key={s.id} className="flex items-center justify-between">
                  <span>{s.name}</span>
                  <Badge variant={st === "APPROVED" ? "default" : "secondary"}>{to(`status.${st}`)}</Badge>
                </li>
              );
            })}
          </ul>
          <Link href="/onboarding/pending" className="text-sm underline">
            {t("requestMore")}
          </Link>
        </div>
      </div>
    </Shell>
  );
}
