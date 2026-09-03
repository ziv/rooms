import { getTranslations } from "next-intl/server";
import { requireOnboarded } from "../guards";
import { listAccessibleSites } from "@/modules/sites/service";
import { listMyBookings } from "@/modules/bookings/service";
import { Shell } from "@/components/layout/shell";
import { BookingsList } from "./bookings-list";

export default async function MyBookingsPage() {
  const actor = await requireOnboarded();
  const [sites, upcoming, past] = await Promise.all([
    listAccessibleSites(actor),
    listMyBookings(actor, { scope: "upcoming" }),
    listMyBookings(actor, { scope: "past", limit: 50 }),
  ]);
  const t = await getTranslations("booking");
  const ser = (rows: typeof upcoming) =>
    rows.map((r) => ({ ...r, startAt: r.startAt.toISOString(), endAt: r.endAt.toISOString() }));
  return (
    <Shell actor={actor} sites={sites}>
      <h1 className="text-xl font-semibold mb-4">{t("upcoming")}</h1>
      <BookingsList rows={ser(upcoming)} />
      <h2 className="text-lg font-semibold mt-8 mb-4">{t("history")}</h2>
      <BookingsList rows={ser(past)} />
    </Shell>
  );
}
