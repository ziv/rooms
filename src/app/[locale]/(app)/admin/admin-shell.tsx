import { Shell } from "@/components/layout/shell";
import { listAccessibleSites } from "@/modules/sites/service";
import type { Actor } from "@/modules/auth/actor";

export async function AdminShell({
  actor,
  currentSiteId,
  children,
}: {
  actor: Actor;
  currentSiteId?: string;
  children: React.ReactNode;
}) {
  const sites = await listAccessibleSites(actor);
  return (
    <Shell actor={actor} sites={sites} currentSiteId={currentSiteId}>
      {children}
    </Shell>
  );
}
