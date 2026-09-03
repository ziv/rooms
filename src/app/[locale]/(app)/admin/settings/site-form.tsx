"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "@/hooks/use-action";
import { updateSiteAction } from "./actions";
import type { Site } from "@/lib/db/schema";

export function SiteForm({ site }: { site: Site }) {
  const t = useTranslations("admin.settings");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    name: site.name,
    address: site.address,
    bookingWindowDays: site.bookingWindowDays,
    cancellationCutoffMinutes: site.cancellationCutoffMinutes,
    status: site.status,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => updateSiteAction({ siteId: site.id, ...form }), {
      onSuccess: () => {
        toast.success(ta("saved"));
        router.refresh();
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{site.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${site.id}`}>{t("name")}</Label>
            <Input
              id={`name-${site.id}`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`address-${site.id}`}>{t("address")}</Label>
            <Input
              id={`address-${site.id}`}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`window-${site.id}`}>{t("bookingWindowDays")}</Label>
              <Input
                id={`window-${site.id}`}
                type="number"
                min={1}
                max={365}
                value={form.bookingWindowDays}
                onChange={(e) => setForm({ ...form, bookingWindowDays: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`cutoff-${site.id}`}>{t("cancellationCutoffMinutes")}</Label>
              <Input
                id={`cutoff-${site.id}`}
                type="number"
                min={0}
                max={10080}
                value={form.cancellationCutoffMinutes}
                onChange={(e) => setForm({ ...form, cancellationCutoffMinutes: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`status-${site.id}`}>{t("status")}</Label>
            <Select
              value={form.status}
              onValueChange={(v) => v && setForm({ ...form, status: v as Site["status"] })}
              items={[
                { value: "ACTIVE", label: t("active") },
                { value: "INACTIVE", label: t("inactive") },
              ]}
            >
              <SelectTrigger id={`status-${site.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                <SelectItem value="INACTIVE">{t("inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {ta("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
