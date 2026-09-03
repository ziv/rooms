import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireOnboarded } from "../../guards";
import { listAccessibleSites } from "@/modules/sites/service";
import { getBooking, canManageBooking } from "@/modules/bookings/service";
import { listRooms } from "@/modules/rooms/service";
import { Shell } from "@/components/layout/shell";
import { BookingDetail } from "./booking-detail";
import { isAppError } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isAdmin } from "@/modules/auth/actor";
import { utcToLocal } from "@/lib/time";

export default async function BookingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const actor = await requireOnboarded();
  const sites = await listAccessibleSites(actor);
  let booking;
  try {
    booking = await getBooking(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, booking.siteId) });
  if (!site) notFound();
  const rooms = await listRooms(actor, booking.siteId);
  const t = await getTranslations("booking");

  const canMove = canManageBooking(actor, booking, site, "move");
  const canCancel = canManageBooking(actor, booking, site, "cancel");

  return (
    <Shell actor={actor} sites={sites} currentSiteId={booking.siteId}>
      <h1 className="text-xl font-semibold mb-4">{t("details")}</h1>
      <BookingDetail
        booking={{
          id: booking.id,
          siteId: booking.siteId,
          siteName: booking.siteName,
          siteAddress: booking.siteAddress,
          timezone: booking.timezone,
          roomId: booking.roomId,
          roomNumber: booking.roomNumber,
          userName: booking.userName,
          startAt: booking.startAt.toISOString(),
          endAt: booking.endAt.toISOString(),
          localDate: utcToLocal(booking.startAt, booking.timezone).date,
          bookingType: booking.bookingType,
          status: booking.status,
          note: booking.note,
          cancellationReason: booking.cancellationReason,
          cancelledAt: booking.cancelledAt?.toISOString() ?? null,
        }}
        rooms={rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber }))}
        canMove={canMove}
        canCancel={canCancel}
        isAdmin={isAdmin(actor)}
      />
    </Shell>
  );
}
