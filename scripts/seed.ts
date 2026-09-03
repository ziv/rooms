/**
 * Seeds development data: two sites, rooms, opening hours.
 * Idempotent: sites are matched by name. Run: pnpm db:seed
 * Production: run once with the real site data, then never again.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

type Segment = { start: string; end: string };
type SiteSeed = { name: string; address: string; rooms: string[]; hours: Record<number, Segment[]> };

const weekdays = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;
const weekdayHours = (segs: Segment[]) => ({
  [weekdays.sun]: segs,
  [weekdays.mon]: segs,
  [weekdays.tue]: segs,
  [weekdays.wed]: segs,
  [weekdays.thu]: segs,
  [weekdays.fri]: [{ start: "08:00", end: "13:00" }],
});

const SITES: SiteSeed[] = [
  {
    name: "מתחם א",
    address: "רחוב הדוגמה 1, תל אביב",
    rooms: ["1", "2", "3", "4"],
    hours: weekdayHours([{ start: "08:00", end: "21:00" }]),
  },
  {
    name: "מתחם ב",
    address: "רחוב הדוגמה 2, רמת גן",
    rooms: ["1", "2", "3"],
    hours: weekdayHours([{ start: "08:00", end: "21:00" }]),
  },
];

async function main() {
  for (const s of SITES) {
    let site = await db.query.sites.findFirst({ where: eq(schema.sites.name, s.name) });
    if (!site) {
      [site] = await db.insert(schema.sites).values({ name: s.name, address: s.address }).returning();
      console.log("created site", site.name);
    }
    for (const [i, roomNumber] of s.rooms.entries()) {
      const exists = await db.query.rooms.findFirst({
        where: and(eq(schema.rooms.siteId, site.id), eq(schema.rooms.roomNumber, roomNumber)),
      });
      if (!exists) await db.insert(schema.rooms).values({ siteId: site.id, roomNumber, displayOrder: i });
    }
    const existingHours = await db.query.openingHours.findMany({ where: eq(schema.openingHours.siteId, site.id) });
    if (existingHours.length === 0) {
      const rows = Object.entries(s.hours).flatMap(([wd, segs]) =>
        segs.map((seg) => ({ siteId: site!.id, weekday: Number(wd), startTime: seg.start, endTime: seg.end })),
      );
      await db.insert(schema.openingHours).values(rows);
    }
  }
  console.log("seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
