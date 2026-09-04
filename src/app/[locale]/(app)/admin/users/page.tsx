import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listUsers } from "@/modules/users/service";
import { listAccessibleSites } from "@/modules/sites/service";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const actor = await requireAdminPage();
  const [users, sites] = await Promise.all([listUsers(actor), listAccessibleSites(actor)]);
  const t = await getTranslations("admin.users");
  return (
    <AdminShell actor={actor}>
      <h1 className="text-xl font-semibold mb-4">{t("title")}</h1>
      <UsersManager
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.globalRole,
          status: u.status,
          locale: u.preferredLocale,
          memberships: u.memberships,
        }))}
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        meId={actor.userId}
      />
    </AdminShell>
  );
}
