"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { decideMembershipAction } from "./actions";
import type { MembershipRow } from "@/modules/memberships/service";
import type { MembershipStatus } from "@/lib/db/schema";

export function MembersTable({ rows }: { rows: MembershipRow[] }) {
  const t = useTranslations("admin.members");
  const ts = useTranslations("onboarding.status");
  const f = useFormatter();
  const router = useRouter();
  const { run, pending } = useAction();

  const decide = (membershipId: string, status: "APPROVED" | "REJECTED" | "SUSPENDED") =>
    run(() => decideMembershipAction({ membershipId, status }), { onSuccess: () => router.refresh() });

  const actionsFor = (r: MembershipRow) => {
    const btn = (
      label: string,
      status: "APPROVED" | "REJECTED" | "SUSPENDED",
      variant: "default" | "outline" | "destructive" = "outline",
    ) => (
      <Button key={status} size="sm" variant={variant} onClick={() => decide(r.id, status)} disabled={pending}>
        {label}
      </Button>
    );
    const map: Record<MembershipStatus, React.ReactNode[]> = {
      PENDING: [btn(t("approve"), "APPROVED", "default"), btn(t("reject"), "REJECTED", "destructive")],
      APPROVED: [btn(t("suspend"), "SUSPENDED", "destructive")],
      SUSPENDED: [btn(t("reinstate"), "APPROVED", "default")],
      REJECTED: [btn(t("approve"), "APPROVED", "default")],
    };
    return map[r.status];
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("name")}</TableHead>
          <TableHead>{t("email")}</TableHead>
          <TableHead>{t("site")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("requestedAt")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.userName ?? <span className="text-muted-foreground">{t("noName")}</span>}</TableCell>
            <TableCell dir="ltr" className="text-start">
              {r.userEmail}
            </TableCell>
            <TableCell>{r.siteName}</TableCell>
            <TableCell>
              <Badge variant={r.status === "APPROVED" ? "default" : "secondary"}>{ts(r.status)}</Badge>
            </TableCell>
            <TableCell>{f.dateTime(r.requestedAt, { dateStyle: "short", timeStyle: "short" })}</TableCell>
            <TableCell className="flex gap-2 justify-end">{actionsFor(r)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
