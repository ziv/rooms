import { sql } from "drizzle-orm";
import type { Tx } from "./index";

/**
 * Transaction-scoped advisory lock keyed by room id. Released automatically at commit/rollback.
 * Always lock rooms in sorted order to avoid deadlocks (see lockRooms).
 */
export async function lockRoom(tx: Tx, roomId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${roomId}))`);
}

export async function lockRooms(tx: Tx, roomIds: string[]): Promise<void> {
  const ids = [...new Set(roomIds)].sort();
  for (const id of ids) await lockRoom(tx, id);
}
