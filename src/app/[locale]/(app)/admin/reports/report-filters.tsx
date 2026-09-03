"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportFilter } from "@/lib/validation/reports";

type Opt = { value: string; label: string };
type Props = {
  filter: ReportFilter;
  sites: Opt[];
  rooms: Opt[];
  therapists: Opt[];
  basePath: string;
};

export function ReportFilters({ filter, sites, rooms, therapists, basePath }: Props) {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const [f, setF] = useState({
    from: filter.from,
    to: filter.to,
    site: filter.siteId ?? "",
    room: filter.roomId ?? "",
    user: filter.userId ?? "",
    type: filter.bookingType ?? "",
    status: filter.status ?? "",
  });
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    router.push(`${basePath}?${q}`);
  };
  const ALL = "__all";
  const sel = (
    id: string,
    label: string,
    value: string,
    items: Opt[],
    allLabel: string,
    onChange: (v: string) => void,
  ) => {
    const list = [{ value: ALL, label: allLabel }, ...items];
    return (
      <div className="space-y-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <Select value={value || ALL} onValueChange={(v) => onChange(!v || v === ALL ? "" : v)} items={list}>
          <SelectTrigger id={id} size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {list.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };
  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-3 mb-4">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs">
          {t("from")}
        </Label>
        <Input
          id="from"
          type="date"
          value={f.from}
          onChange={(e) => setF({ ...f, from: e.target.value })}
          className="h-8 w-40"
          dir="ltr"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs">
          {t("to")}
        </Label>
        <Input
          id="to"
          type="date"
          value={f.to}
          onChange={(e) => setF({ ...f, to: e.target.value })}
          className="h-8 w-40"
          dir="ltr"
        />
      </div>
      {sel("site", t("site"), f.site, sites, t("allSites"), (v) => setF({ ...f, site: v, room: "" }))}
      {sel(
        "room",
        t("room"),
        f.room,
        rooms
          .filter((r) => !f.site || r.value.startsWith(f.site + ":"))
          .map((r) => ({ value: r.value.split(":")[1], label: r.label })),
        t("allRooms"),
        (v) => setF({ ...f, room: v }),
      )}
      {sel("user", t("therapist"), f.user, therapists, t("allTherapists"), (v) => setF({ ...f, user: v }))}
      {sel(
        "type",
        t("type"),
        f.type,
        [
          { value: "REGULAR", label: t("regular") },
          { value: "SERIES", label: t("series") },
        ],
        t("all"),
        (v) => setF({ ...f, type: v }),
      )}
      {sel(
        "status",
        t("status"),
        f.status,
        [
          { value: "CONFIRMED", label: "CONFIRMED" },
          { value: "CANCELLED", label: "CANCELLED" },
        ],
        t("all"),
        (v) => setF({ ...f, status: v }),
      )}
      <Button type="submit" size="sm">
        {t("apply")}
      </Button>
    </form>
  );
}
