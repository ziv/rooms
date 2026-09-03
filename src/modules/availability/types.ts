import type { BookingType } from "@/lib/db/schema";

export type AvailabilityBlock =
  | { kind: "BUSY"; start: string; end: string }
  | { kind: "CLOSED"; start: string; end: string; reason?: string | null }
  | {
      kind: "MINE";
      start: string;
      end: string;
      bookingId: string;
      type: BookingType;
      note?: string | null;
      seriesId?: string | null;
    }
  | {
      kind: "BOOKING";
      start: string;
      end: string;
      bookingId: string;
      type: BookingType;
      note?: string | null;
      seriesId?: string | null;
      user: { id: string; fullName: string | null };
    };

export type RoomAvailability = {
  roomId: string;
  roomNumber: string;
  openSegments: { start: string; end: string }[];
  blocks: AvailabilityBlock[];
};

export type DayAvailability = {
  siteId: string;
  siteName: string;
  date: string;
  timezone: string;
  /** Therapist constraints (ISO instants); null for admins. */
  bookingWindow: { from: string; to: string } | null;
  isAdmin: boolean;
  rooms: RoomAvailability[];
};
