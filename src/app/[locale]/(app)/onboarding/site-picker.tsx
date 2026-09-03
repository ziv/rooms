"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/hooks/use-action";
import { requestMembershipAction } from "./actions";
import type { MembershipStatus } from "@/lib/db/schema";

type SiteRow = { id: string; name: string; address: string; status: MembershipStatus | null };

export function SitePicker({ sites }: { sites: SiteRow[] }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { run, pending } = useAction();

  const request = (siteId: string) =>
    run(() => requestMembershipAction({ siteId }), { onSuccess: () => router.refresh() });

  return (
    <div className="space-y-3">
      {sites.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted-foreground">{s.address}</div>
            </div>
            {s.status === null || s.status === "REJECTED" ? (
              <Button size="sm" onClick={() => request(s.id)} disabled={pending}>
                {t("request")}
              </Button>
            ) : (
              <Badge variant={s.status === "APPROVED" ? "default" : "secondary"}>{t(`status.${s.status}`)}</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
