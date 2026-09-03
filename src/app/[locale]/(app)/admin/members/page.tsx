import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listMemberships } from "@/modules/memberships/service";
import { MembersTable } from "./members-table";
import { Link } from "@/i18n/navigation";
import type { MembershipStatus } from "@/lib/db/schema";

const STATUSES: MembershipStatus[] = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"];

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requireAdminPage();
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as MembershipStatus) ? (status as MembershipStatus) : undefined;
  const t = await getTranslations("admin.members");
  const ts = await getTranslations("onboarding.status");
  const rows = await listMemberships(actor, filter ? { status: filter } : {});

  return (
    <AdminShell actor={actor}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/members" className={!filter ? "font-semibold underline" : ""}>
            {t("filterAll")}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={{ pathname: "/admin/members", query: { status: s } }}
              className={filter === s ? "font-semibold underline" : ""}
            >
              {ts(s)}
            </Link>
          ))}
        </nav>
      </div>
      <MembersTable rows={rows} />
    </AdminShell>
  );
}
