import { getTranslations } from "next-intl/server";
import { requireOnboarded } from "../guards";
import { listAccessibleSites } from "@/modules/sites/service";
import { Shell } from "@/components/layout/shell";

export default async function MyBookingsPage() {
  const actor = await requireOnboarded();
  const sites = await listAccessibleSites(actor);
  const t = await getTranslations("nav");
  return (
    <Shell actor={actor} sites={sites}>
      <h1 className="text-xl font-semibold mb-2">{t("myBookings")}</h1>
      <p className="text-muted-foreground">M1</p>
    </Shell>
  );
}
