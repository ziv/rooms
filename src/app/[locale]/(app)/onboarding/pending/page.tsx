import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireSession } from "../../guards";
import { listActiveSites } from "@/modules/sites/service";
import { SitePicker } from "../site-picker";
import { approvedSiteIds, isAdmin } from "@/modules/auth/actor";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

export default async function PendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const actor = await requireSession();
  if (!actor.fullName) redirect(`/${locale}/onboarding`);
  const t = await getTranslations("onboarding");
  const sites = await listActiveSites();
  const statusBySite = new Map(actor.memberships.map((m) => [m.siteId, m.status]));
  const hasAccess = isAdmin(actor) || approvedSiteIds(actor).length > 0;

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <UserMenu actor={actor} admin={isAdmin(actor)} />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{t("pendingTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pendingSubtitle")}</p>
        </div>
        <SitePicker
          sites={sites.map((s) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            status: statusBySite.get(s.id) ?? null,
          }))}
        />
        {hasAccess && (
          <Button className="w-full" nativeButton={false} render={<Link href="/calendar" />}>
            {t("goToCalendar")}
          </Button>
        )}
      </div>
    </main>
  );
}
