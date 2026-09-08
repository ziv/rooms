import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Actor } from "@/modules/auth/actor";
import { isAdmin } from "@/modules/auth/actor";
import type { Site } from "@/lib/db/schema";
import { LogoMark } from "@/components/brand/flowers";
import { NavLink } from "./nav-link";
import { SiteSwitcher } from "./site-switcher";
import { UserMenu } from "./user-menu";

type Props = { actor: Actor; sites: Site[]; currentSiteId?: string; children: React.ReactNode };

export async function Shell({ actor, sites, currentSiteId, children }: Props) {
  const t = await getTranslations("nav");
  const admin = isAdmin(actor);
  const adminLinks: [string, string][] = [
    ["/admin/dashboard", t("dashboard")],
    ["/admin/members", t("members")],
    ["/admin/users", t("users")],
    ["/admin/rooms", t("rooms")],
    ["/admin/hours", t("hours")],
    ["/admin/closures", t("closures")],
    ["/admin/series", t("series")],
    ["/admin/reports", t("reports")],
    ["/admin/audit", t("audit")],
    ["/admin/settings", t("settings")],
  ];
  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-30 overflow-x-clip border-b border-border/70 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
          <Link href="/calendar" className="flex items-center gap-2 font-semibold whitespace-nowrap tracking-tight">
            <LogoMark />
            <span>Rooms</span>
          </Link>
          {sites.length > 1 && <SiteSwitcher sites={sites} currentSiteId={currentSiteId} />}
          <nav className="hidden md:flex items-center gap-1 ms-auto">
            <NavLink href="/calendar">{t("calendar")}</NavLink>
            <NavLink href="/bookings">{t("myBookings")}</NavLink>
            {admin && <NavLink href="/admin">{t("admin")}</NavLink>}
          </nav>
          <div className={sites.length > 1 ? "" : "ms-auto"}>
            <UserMenu actor={actor} admin={admin} />
          </div>
        </div>
        {admin && (
          <div className="border-t border-border/60 bg-muted/40">
            <div className="mx-auto max-w-6xl px-2 h-11 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
              {adminLinks.map(([href, label]) => (
                <NavLink key={href} href={href} className="text-[0.8rem] py-1">
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">{children}</main>
    </div>
  );
}
