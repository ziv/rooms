import "server-only";
import { after } from "next/server";
import { flushNotifications } from "./sender";

/** Schedules an outbox flush after the current response is sent. Errors are swallowed (cron retries). */
export function flushAfterResponse(): void {
  after(async () => {
    try {
      await flushNotifications();
    } catch (e) {
      console.error("notification flush failed", e);
    }
  });
}
