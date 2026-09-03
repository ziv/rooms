import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inviteUser, listUsers, setUserRole } from "@/modules/users/service";
import type { AuthAdmin } from "@/modules/users/auth-admin";
import { actorFor, makeMembership, makeSite, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

const fakeAuth = (): AuthAdmin & { calls: string[] } => {
  const ids = new Map<string, string>();
  const calls: string[] = [];
  return {
    calls,
    async ensureAuthUser(email) {
      calls.push(email);
      const existing = ids.get(email);
      if (existing) return { id: existing, created: false };
      const id = randomUUID();
      ids.set(email, id);
      return { id, created: true };
    },
  };
};

describe("managers", () => {
  it("promotes and demotes; the last manager cannot be demoted; therapists are forbidden", async () => {
    const admin = await makeUser({ role: "SUPER_ADMIN" });
    const t = await makeUser();
    await expect(setUserRole(actorFor(t), { userId: t.id, role: "SUPER_ADMIN" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(setUserRole(actorFor(admin), { userId: admin.id, role: "THERAPIST" })).rejects.toMatchObject({
      code: "LAST_ADMIN",
    });

    const promoted = await setUserRole(actorFor(admin), { userId: t.id, role: "SUPER_ADMIN" });
    expect(promoted.globalRole).toBe("SUPER_ADMIN");
    expect(await db.$count(schema.users, eq(schema.users.globalRole, "SUPER_ADMIN"))).toBe(2);
    // now the first admin can step down
    const demoted = await setUserRole(actorFor(promoted), { userId: admin.id, role: "THERAPIST" });
    expect(demoted.globalRole).toBe("THERAPIST");
    const audit = await db.query.auditEvents.findMany({ where: eq(schema.auditEvents.entityType, "user") });
    expect(audit.map((a) => a.action).sort()).toEqual(["ROLE_GRANTED", "ROLE_REVOKED"]);
    const notes = await db.query.notifications.findMany({ where: eq(schema.notifications.type, "ROLE_CHANGED") });
    expect(notes.map((n) => n.userId).sort()).toEqual([admin.id, t.id].sort());
  });

  it("invites a new user with approved memberships and email; reuses an existing account", async () => {
    const admin = await makeUser({ role: "SUPER_ADMIN", fullName: "Boss" });
    const siteA = await makeSite("A");
    const siteB = await makeSite("B");
    const auth = fakeAuth();
    const a = actorFor(admin);

    const { user, created } = await inviteUser(
      a,
      {
        email: "New@Example.com".toLowerCase(),
        fullName: "New One",
        locale: "en",
        siteIds: [siteA.id, siteB.id],
        role: "THERAPIST",
      },
      auth,
    );
    expect(created).toBe(true);
    expect(user.fullName).toBe("New One");
    const ms = await db.query.siteMemberships.findMany({ where: eq(schema.siteMemberships.userId, user.id) });
    expect(ms.map((m) => m.status)).toEqual(["APPROVED", "APPROVED"]);
    const notes = await db.query.notifications.findMany({ where: eq(schema.notifications.userId, user.id) });
    expect(notes.map((n) => n.type)).toEqual(["USER_INVITED"]);
    expect((notes[0].payload as { siteNames: string[] }).siteNames.sort()).toEqual(["A", "B"]);

    // existing therapist with a pending request: invite approves it, keeps their name
    const existing = await makeUser({ email: "old@example.com", fullName: "Old Name" });
    await makeMembership(siteA.id, existing.id, "PENDING");
    (auth as unknown as { ensureAuthUser: AuthAdmin["ensureAuthUser"] }).ensureAuthUser = async () => ({
      id: existing.id,
      created: false,
    });
    const again = await inviteUser(
      a,
      { email: "old@example.com", fullName: "Ignored", locale: "he", siteIds: [siteA.id], role: "THERAPIST" },
      auth,
    );
    expect(again.created).toBe(false);
    expect(again.user.fullName).toBe("Old Name");
    const m = await db.query.siteMemberships.findFirst({ where: eq(schema.siteMemberships.userId, existing.id) });
    expect(m?.status).toBe("APPROVED");

    // invite as manager
    const auth2 = fakeAuth();
    const mgr = await inviteUser(
      a,
      { email: "mgr@example.com", fullName: "Mgr", locale: "he", siteIds: [], role: "SUPER_ADMIN" },
      auth2,
    );
    expect(mgr.user.globalRole).toBe("SUPER_ADMIN");

    const rows = await listUsers(a);
    expect(
      rows
        .find((r) => r.id === user.id)
        ?.memberships.map((x) => x.siteName)
        .sort(),
    ).toEqual(["A", "B"]);
    await expect(
      inviteUser(
        actorFor(existing),
        { email: "x@example.com", fullName: "X Y", locale: "he", siteIds: [], role: "THERAPIST" },
        auth2,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
