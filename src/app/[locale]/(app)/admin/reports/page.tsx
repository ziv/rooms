import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdminPage } from "../../guards";
import { AdminShell } from "../admin-shell";
import { listAccessibleSites } from "@/modules/sites/service";
import { hoursSummary, bookingsDetail, type HoursSummary } from "@/modules/reports/service";
import { parseFilter, filterToQuery } from "./filters";
import { ReportFilters } from "./report-filters";
import { db, schema } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { notDeleted } from "@/modules/users/service";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { CsvButton } from "./csv-button";

const PAGE = 100;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const raw = await searchParams;
  const actor = await requireAdminPage();
  const filter = parseFilter(raw);
  const pageNo = Math.max(1, Number(raw.page) || 1);
  const [sites, rooms, therapists, summary, detail] = await Promise.all([
    listAccessibleSites(actor),
    db
      .select({ id: schema.rooms.id, siteId: schema.rooms.siteId, roomNumber: schema.rooms.roomNumber })
      .from(schema.rooms)
      .orderBy(asc(schema.rooms.displayOrder)),
    db
      .select({ id: schema.users.id, name: schema.users.fullName, email: schema.users.email })
      .from(schema.users)
      .where(and(eq(schema.users.status, "ACTIVE"), notDeleted()))
      .orderBy(asc(schema.users.fullName)),
    hoursSummary(actor, filter),
    bookingsDetail(actor, filter, { limit: PAGE + 1, offset: (pageNo - 1) * PAGE }),
  ]);
  const t = await getTranslations("admin.reports");
  const f = await getFormatter();
  const q = filterToQuery(filter);
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "";
  const hours = (n: number) => f.number(n, { maximumFractionDigits: 2 });

  return (
    <AdminShell actor={actor} currentSiteId={filter.siteId}>
      <h1 className="text-xl font-semibold mb-1">{t("title")}</h1>
      <p className="text-sm text-muted-foreground mb-4">{t("planned")}</p>
      <ReportFilters
        filter={filter}
        sites={sites.map((s) => ({ value: s.id, label: s.name }))}
        rooms={rooms.map((r) => ({ value: `${r.siteId}:${r.id}`, label: `${siteName(r.siteId)} · ${r.roomNumber}` }))}
        therapists={therapists.map((u) => ({ value: u.id, label: u.name ?? u.email }))}
        basePath={`/${locale}/admin/reports`}
      />

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">{t("hoursTitle")}</h2>
          <CsvButton href={`/api/reports/hours?${new URLSearchParams(q)}`} label={t("csv")} warning={t("csvWarning")} />
        </div>
        {summary.byTherapist.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <HoursTable rows={summary.byTherapist} label={t("byTherapist")} t={t} hours={hours} />
            <HoursTable rows={summary.byRoom} label={t("byRoom")} t={t} hours={hours} />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">{t("detailTitle")}</h2>
          <CsvButton
            href={`/api/reports/bookings?${new URLSearchParams(q)}`}
            label={t("csv")}
            warning={t("csvWarning")}
          />
        </div>
        {detail.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("time")}</TableHead>
                <TableHead>{t("site")}</TableHead>
                <TableHead>{t("room")}</TableHead>
                <TableHead>{t("therapist")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("cancelledBy")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.slice(0, PAGE).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {f.dateTime(r.startAt, { dateStyle: "short", timeZone: "Asia/Jerusalem" })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap" dir="ltr">
                    {f.dateTime(r.startAt, { timeStyle: "short", timeZone: "Asia/Jerusalem" })}–
                    {f.dateTime(r.endAt, { timeStyle: "short", timeZone: "Asia/Jerusalem" })}
                  </TableCell>
                  <TableCell>{r.siteName}</TableCell>
                  <TableCell>{r.roomNumber}</TableCell>
                  <TableCell>
                    <Link href={`/bookings/${r.id}`} className="underline">
                      {r.userName ?? r.userEmail}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.bookingType === "SERIES" ? t("series") : t("regular")}
                    {r.isException && (
                      <Badge variant="outline" className="ms-1">
                        {t("exception")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "CANCELLED" ? <Badge variant="secondary">CANCELLED</Badge> : "CONFIRMED"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.cancelledByName}
                    {r.cancelledAt &&
                      ` · ${f.dateTime(r.cancelledAt, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" })}`}
                    {r.cancellationReason && ` · ${r.cancellationReason}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {detail.length > PAGE && (
          <Link
            href={{ pathname: "/admin/reports", query: { ...q, page: String(pageNo + 1) } }}
            className="text-sm underline mt-3 inline-block"
          >
            {t("more")} ›
          </Link>
        )}
      </section>
    </AdminShell>
  );
}

type HoursTableProps = {
  rows: HoursSummary["byTherapist"];
  label: string;
  t: Awaited<ReturnType<typeof getTranslations<"admin.reports">>>;
  hours: (n: number) => string;
};

function HoursTable({ rows, label, t, hours }: HoursTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-end">{t("regular")}</TableHead>
          <TableHead className="text-end">{t("series")}</TableHead>
          <TableHead className="text-end">{t("total")}</TableHead>
          <TableHead className="text-end">{t("bookings")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell>{r.label}</TableCell>
            <TableCell className="text-end tabular-nums">{hours(r.regularHours)}</TableCell>
            <TableCell className="text-end tabular-nums">{hours(r.seriesHours)}</TableCell>
            <TableCell className="text-end tabular-nums font-medium">{hours(r.totalHours)}</TableCell>
            <TableCell className="text-end tabular-nums">{r.bookings}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-medium">{t("totalAll")}</TableCell>
          <TableCell colSpan={2} />
          <TableCell className="text-end tabular-nums font-medium">
            {hours(rows.reduce((s, r) => s + r.totalHours, 0))}
          </TableCell>
          <TableCell className="text-end tabular-nums">{rows.reduce((s, r) => s + r.bookings, 0)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
