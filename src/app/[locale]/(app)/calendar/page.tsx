import { redirect } from "next/navigation";
import { requireOnboarded } from "../guards";
import { listAccessibleSites } from "@/modules/sites/service";

export default async function CalendarIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const actor = await requireOnboarded();
  const sites = await listAccessibleSites(actor);
  if (sites.length === 0) redirect(`/${locale}/onboarding/pending`);
  redirect(`/${locale}/calendar/${sites[0].id}`);
}
