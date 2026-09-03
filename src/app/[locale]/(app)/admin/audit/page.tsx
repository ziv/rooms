import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listAuditEvents } from "@/modules/audit/service";
import { listAccessibleSites } from "@/modules/sites/service";
import { Link } from "@/i18n/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ENTITY_TYPES = ["booking", "series", "closure", "membership", "room", "site", "user"];
const PAGE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; entity?: string; page?: string }>;
}) {
  const actor = await requireAdminPage();
  const { site, entity, page } = await searchParams;
  const sites = await listAccessibleSites(actor);
  const pageNo = Math.max(1, Number(page) || 1);
  const rows = await listAuditEvents(actor, {
    siteId: sites.some((s) => s.id === site) ? site : undefined,
    entityType: ENTITY_TYPES.includes(entity ?? "") ? entity : undefined,
    limit: PAGE + 1,
    offset: (pageNo - 1) * PAGE,
  });
  const hasMore = rows.length > PAGE;
  const t = await getTranslations("admin.audit");
  const f = await getFormatter();
  const q = (patch: Record<string, string | undefined>) => ({
    pathname: "/admin/audit" as const,
    query: Object.fromEntries(Object.entries({ site, entity, ...patch }).filter(([, v]) => v)),
  });

  return (
    <AdminShell actor={actor}>
      <h1 className="text-xl font-semibold mb-4">{t("title")}</h1>
      <div className="flex flex-wrap gap-4 text-sm mb-4">
        <nav className="flex gap-2">
          <Link href={q({ site: undefined, page: undefined })} className={!site ? "font-semibold underline" : ""}>
            {t("allSites")}
          </Link>
          {sites.map((s) => (
            <Link
              key={s.id}
              href={q({ site: s.id, page: undefined })}
              className={site === s.id ? "font-semibold underline" : ""}
            >
              {s.name}
            </Link>
          ))}
        </nav>
        <nav className="flex gap-2">
          <Link href={q({ entity: undefined, page: undefined })} className={!entity ? "font-semibold underline" : ""}>
            {t("all")}
          </Link>
          {ENTITY_TYPES.map((e) => (
            <Link
              key={e}
              href={q({ entity: e, page: undefined })}
              className={entity === e ? "font-semibold underline" : ""}
            >
              {e}
            </Link>
          ))}
        </nav>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("when")}</TableHead>
              <TableHead>{t("actor")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("entity")}</TableHead>
              <TableHead>{t("details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, PAGE).map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell className="whitespace-nowrap">
                  {f.dateTime(r.createdAt, { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell>{r.actorName ?? (r.actorUserId ? r.actorUserId.slice(0, 8) : t("system"))}</TableCell>
                <TableCell>
                  <code className="text-xs">{r.action}</code>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.entityType}{" "}
                  {r.entityType === "booking" ? (
                    <Link href={`/bookings/${r.entityId}`} className="underline text-xs" dir="ltr">
                      {r.entityId.slice(0, 8)}
                    </Link>
                  ) : r.entityType === "series" ? (
                    <Link href={`/admin/series/${r.entityId}`} className="underline text-xs" dir="ltr">
                      {r.entityId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-xs" dir="ltr">
                      {r.entityId.slice(0, 8)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">{t("details")}</summary>
                    <pre dir="ltr" className="text-xs whitespace-pre-wrap max-w-xl">
                      {r.before ? `${t("before")}: ${JSON.stringify(r.before, null, 1)}\n` : ""}
                      {r.after ? `${t("after")}: ${JSON.stringify(r.after, null, 1)}` : ""}
                    </pre>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {hasMore && (
        <div className="mt-4">
          <Link href={q({ page: String(pageNo + 1) })} className="text-sm underline">
            {t("more")} ›
          </Link>
        </div>
      )}
    </AdminShell>
  );
}
