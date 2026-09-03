import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getActor } from "@/modules/auth/current";
import { getBooking } from "@/modules/bookings/service";
import { buildIcs } from "@/modules/ics/build";
import { isAppError } from "@/lib/errors";
import { env } from "@/lib/env";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const b = await getBooking(actor, id);
    const t = await getTranslations({ locale: actor.locale, namespace: "calendar" });
    const ics = buildIcs({
      uid: `${b.id}@rooms`,
      sequence: b.version,
      startAt: b.startAt,
      endAt: b.endAt,
      timezone: b.timezone,
      summary: `${t("room")} ${b.roomNumber} · ${b.siteName}`,
      location: b.siteAddress,
      url: `${env().APP_URL}/${actor.locale}/bookings/${b.id}`,
      cancelled: b.status === "CANCELLED",
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    });
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="booking-${b.id.slice(0, 8)}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
