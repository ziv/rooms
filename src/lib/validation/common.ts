import { z } from "zod";

export const uuid = z.string().uuid();
export const localeSchema = z.enum(["he", "en"]);
export const fullNameSchema = z.string().trim().min(2).max(80);
/** "HH:mm" local time */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");
/** "YYYY-MM-DD" local date */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const weekday = z.number().int().min(0).max(6);
