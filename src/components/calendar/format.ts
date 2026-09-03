"use client";

import { useFormatter } from "next-intl";

/** Time/date formatters bound to the site timezone. */
export function useSiteFormat(timeZone: string) {
  const f = useFormatter();
  const time = (d: Date | string) =>
    f.dateTime(new Date(d), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
  return {
    time,
    /** "HH:mm–HH:mm" wrapped in a bidi isolate so it reads left-to-right inside RTL text. */
    range: (a: Date | string, b: Date | string) => `\u2066${time(a)}–${time(b)}\u2069`,
    date: (d: Date | string) => f.dateTime(new Date(d), { dateStyle: "full", timeZone }),
    dateShort: (d: Date | string) => f.dateTime(new Date(d), { dateStyle: "medium", timeZone }),
    dateTime: (d: Date | string) => f.dateTime(new Date(d), { dateStyle: "medium", timeStyle: "short", timeZone }),
  };
}
