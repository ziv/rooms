import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireSession } from "../guards";
import { listActiveSites } from "@/modules/sites/service";
import { ProfileForm } from "./profile-form";
import { SitePicker } from "./site-picker";
import { approvedSiteIds, isAdmin } from "@/modules/auth/actor";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const actor = await requireSession();
  const t = await getTranslations("onboarding");

  if (!actor.fullName) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold">{t("profileTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("profileSubtitle")}</p>
          </div>
          <ProfileForm defaultLocale={actor.locale} />
        </div>
      </main>
    );
  }

  if (isAdmin(actor) || approvedSiteIds(actor).length > 0) redirect(`/${locale}/calendar`);

  const sites = await listActiveSites();
  const statusBySite = new Map(actor.memberships.map((m) => [m.siteId, m.status]));
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{t("sitesTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("sitesSubtitle")}</p>
        </div>
        <SitePicker
          sites={sites.map((s) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            status: statusBySite.get(s.id) ?? null,
          }))}
        />
      </div>
    </main>
  );
}
