import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listMemberships } from "@/modules/memberships/service";
import { listAccessibleSites } from "@/modules/sites/service";
import { getDayAvailability } from "@/modules/availability/service";
import { MembersTable } from "../members/members-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { todayLocal } from "@/lib/time";
import { TodayList } from "./today-list";

export default async function DashboardPage() {
  const actor = await requireAdminPage();
  const t = await getTranslations("admin.dashboard");
  const [pending, sites] = await Promise.all([
    listMemberships(actor, { status: "PENDING" }),
    listAccessibleSites(actor),
  ]);
  const days = await Promise.all(
    sites.map((s) => getDayAvailability(actor, { siteId: s.id, date: todayLocal(s.timezone) })),
  );
  return (
    <AdminShell actor={actor}>
      <h1 className="text-xl font-semibold mb-6">{t("title")}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {t("pending")} ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPending")}</p>
            ) : (
              <MembersTable rows={pending} />
            )}
          </CardContent>
        </Card>
        {sites.map((s, i) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/calendar/${s.id}`} className="hover:underline">
                  {s.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-muted-foreground">{s.address}</div>
              <div className="font-medium">{t("today")}</div>
              <TodayList day={days[i]} />
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
