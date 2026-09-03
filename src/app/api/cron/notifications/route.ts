import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { flushNotifications } from "@/modules/notifications/sender";

/** Retries pending/failed notifications. Called by pg_cron (or Vercel Cron) every 10 minutes. */
async function handle(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await flushNotifications({ limit: 50 });
  return NextResponse.json(result);
}
export const GET = handle;
export const POST = handle;
