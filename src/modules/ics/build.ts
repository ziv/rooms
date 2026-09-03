/** Minimal iCalendar builder for one booking. No external dependency. */
export type IcsInput = {
  uid: string;
  sequence: number;
  startAt: Date;
  endAt: Date;
  timezone: string;
  summary: string;
  location: string;
  description?: string;
  url?: string;
  cancelled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 line folding at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > 75) {
      out.push(cur);
      cur = " " + ch;
      bytes = 1 + b;
    } else {
      cur += ch;
      bytes += b;
    }
  }
  out.push(cur);
  return out.join("\r\n");
}

export function buildIcs(i: IcsInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//rooms//booking//HE",
    "CALSCALE:GREGORIAN",
    `METHOD:${i.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${i.uid}`,
    `SEQUENCE:${i.sequence}`,
    `DTSTAMP:${utcStamp(i.updatedAt)}`,
    `CREATED:${utcStamp(i.createdAt)}`,
    `LAST-MODIFIED:${utcStamp(i.updatedAt)}`,
    // UTC instants are unambiguous and understood by every client; the site tz is informational.
    `DTSTART:${utcStamp(i.startAt)}`,
    `DTEND:${utcStamp(i.endAt)}`,
    `SUMMARY:${escape(i.summary)}`,
    `LOCATION:${escape(i.location)}`,
    ...(i.description ? [`DESCRIPTION:${escape(i.description)}`] : []),
    ...(i.url ? [`URL:${i.url}`] : []),
    `STATUS:${i.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `X-ROOMS-TZ:${i.timezone}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
