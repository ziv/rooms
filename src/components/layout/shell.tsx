import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Actor } from "@/modules/auth/actor";
import { isAdmin } from "@/modules/auth/actor";
import type { Site } from "@/lib/db/schema";
import { SiteSwitcher } from "./site-switcher";
import { UserMenu } from "./user-menu";

type Props = { actor: Actor; sites: Site[]; currentSiteId?: string; children: React.ReactNode };

export async function Shell({ actor, sites, currentSiteId, children }: Props) {
  const t = await getTranslations("nav");
  const admin = isAdmin(actor);
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <Link href="/calendar" className="font-semibold whitespace-nowrap">
            Rooms
          </Link>
          {sites.length > 1 && <SiteSwitcher sites={sites} currentSiteId={currentSiteId} />}
          <nav className="hidden md:flex items-center gap-4 text-sm ms-auto">
            <Link href="/calendar">{t("calendar")}</Link>
            <Link href="/bookings">{t("myBookings")}</Link>
            {admin && <Link href="/admin/dashboard">{t("admin")}</Link>}
          </nav>
          <div className={sites.length > 1 ? "" : "ms-auto"}>
            <UserMenu actor={actor} admin={admin} />
          </div>
        </div>
        {admin && (
          <div className="border-t bg-muted/40">
            <div className="mx-auto max-w-6xl px-4 h-10 flex items-center gap-4 text-sm overflow-x-auto">
              <Link href="/admin/dashboard">{t("dashboard")}</Link>
              <Link href="/admin/members">{t("members")}</Link>
              <Link href="/admin/users">{t("users")}</Link>
              <Link href="/admin/rooms">{t("rooms")}</Link>
              <Link href="/admin/hours">{t("hours")}</Link>
              <Link href="/admin/closures">{t("closures")}</Link>
              <Link href="/admin/series">{t("series")}</Link>
              <Link href="/admin/reports">{t("reports")}</Link>
              <Link href="/admin/audit">{t("audit")}</Link>
              <Link href="/admin/settings">{t("settings")}</Link>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">{children}</main>
    </div>
  );
}
