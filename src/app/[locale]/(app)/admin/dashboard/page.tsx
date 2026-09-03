import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listMemberships } from "@/modules/memberships/service";
import { listAccessibleSites } from "@/modules/sites/service";
import { MembersTable } from "../members/members-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export default async function DashboardPage() {
  const actor = await requireAdminPage();
  const t = await getTranslations("admin.dashboard");
  const [pending, sites] = await Promise.all([
    listMemberships(actor, { status: "PENDING" }),
    listAccessibleSites(actor),
  ]);
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
        {sites.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div>{s.address}</div>
              <Link href={`/calendar/${s.id}`} className="underline">
                {s.name}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
