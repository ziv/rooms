"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import {
  deleteUserAction,
  inviteUserAction,
  setUserRoleAction,
  setUserStatusAction,
  updateUserAction,
} from "./actions";
import { LOCALES, type Locale } from "@/i18n/routing";

export type UserView = {
  id: string;
  email: string;
  fullName: string | null;
  role: "THERAPIST" | "SUPER_ADMIN";
  status: "ACTIVE" | "DISABLED";
  locale: string;
  memberships: { siteId: string; siteName: string; status: string }[];
};

type Props = { users: UserView[]; sites: { id: string; name: string }[]; meId: string };

export function UsersManager({ users, sites, meId }: Props) {
  const t = useTranslations("admin.users");
  const tm = useTranslations("onboarding.status");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ user: UserView; role: "THERAPIST" | "SUPER_ADMIN" } | null>(null);
  const [editing, setEditing] = useState<UserView | null>(null);
  const [deleting, setDeleting] = useState<UserView | null>(null);

  const setStatus = (u: UserView, status: "ACTIVE" | "DISABLED") =>
    run(() => setUserStatusAction({ userId: u.id, status }), {
      onSuccess: () => {
        toast.success(t("statusUpdated"));
        router.refresh();
      },
      onError: (r) => {
        if (r.code === "LAST_ADMIN") {
          toast.error(t("lastAdmin"));
          return true;
        }
        return false;
      },
    });
  const doDelete = () => {
    if (!deleting) return;
    run(() => deleteUserAction({ userId: deleting.id }), {
      onSuccess: (r) => {
        toast.success(
          r.mode === "HARD"
            ? t("deleted")
            : t("deletedAnon", { bookings: r.cancelledBookings, series: r.cancelledSeries }),
        );
        setDeleting(null);
        router.refresh();
      },
      onError: (r) => {
        if (r.code === "LAST_ADMIN") {
          toast.error(t("lastAdmin"));
          setDeleting(null);
          return true;
        }
        return false;
      },
    });
  };

  const applyRole = () => {
    if (!confirm) return;
    run(() => setUserRoleAction({ userId: confirm.user.id, role: confirm.role }), {
      onSuccess: () => {
        toast.success(t("roleUpdated"));
        setConfirm(null);
        router.refresh();
      },
      onError: (r) => {
        if (r.code === "LAST_ADMIN") {
          toast.error(t("lastAdmin"));
          setConfirm(null);
          return true;
        }
        return false;
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>{t("add")}</Button>
      </div>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("sites")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  {u.fullName ?? <span className="text-muted-foreground">{t("noName")}</span>}{" "}
                  {u.id === meId && <span className="text-xs text-muted-foreground">{t("you")}</span>}
                </TableCell>
                <TableCell dir="ltr" className="text-start">
                  {u.email}
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "SUPER_ADMIN" ? "default" : "outline"}>{t(`role${u.role}`)}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {u.memberships.map((m) => (
                    <span key={m.siteId} className="me-2 whitespace-nowrap">
                      {m.siteName}: {tm(m.status as "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED")}
                    </span>
                  ))}
                </TableCell>
                <TableCell>{t(`status${u.status}`)}</TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  <div className="inline-flex gap-1.5">
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(u)}>
                      {t("edit")}
                    </Button>
                    {u.status === "ACTIVE" &&
                      (u.role === "SUPER_ADMIN" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => setConfirm({ user: u, role: "THERAPIST" })}
                        >
                          {t("demote")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => setConfirm({ user: u, role: "SUPER_ADMIN" })}
                        >
                          {t("promote")}
                        </Button>
                      ))}
                    {u.id !== meId && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setStatus(u, u.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
                      >
                        {u.status === "ACTIVE" ? t("disable") : t("enable")}
                      </Button>
                    )}
                    {u.id !== meId && (
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => setDeleting(u)}>
                        {t("delete")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.role === "SUPER_ADMIN" ? t("promote") : t("demote")}</DialogTitle>
            <DialogDescription>
              {confirm &&
                t(confirm.role === "SUPER_ADMIN" ? "promoteConfirm" : "demoteConfirm", {
                  name: confirm.user.fullName ?? confirm.user.email,
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              {ta("cancel")}
            </Button>
            <Button
              onClick={applyRole}
              disabled={pending}
              variant={confirm?.role === "THERAPIST" ? "destructive" : "default"}
            >
              {ta("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {addOpen && <AddUserDialog sites={sites} onClose={() => setAddOpen(false)} />}
      {editing && <EditUserDialog user={editing} onClose={() => setEditing(null)} />}

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("deleteTitle")}: {deleting?.fullName ?? deleting?.email}
            </DialogTitle>
            <DialogDescription>{t("deleteHint")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              {ta("cancel")}
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditUserDialog({ user, onClose }: { user: UserView; onClose: () => void }) {
  const t = useTranslations("admin.users");
  const tl = useTranslations("locale");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    fullName: user.fullName ?? "",
    email: user.email,
    locale: (user.locale === "en" ? "en" : "he") as Locale,
  });
  const localeItems = LOCALES.map((l) => ({ value: l, label: tl(l) }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => updateUserAction({ userId: user.id, ...form }), {
      onSuccess: () => {
        toast.success(t("updated"));
        onClose();
        router.refresh();
      },
      onError: (r) => {
        if (r.code === "ALREADY_EXISTS") {
          toast.error(t("emailInUse"));
          return true;
        }
        return false;
      },
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription dir="ltr" className="text-start">
            {user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">{t("name")}</Label>
            <Input
              id="edit-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              minLength={2}
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">{t("email")}</Label>
            <Input
              id="edit-email"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-locale">{t("language")}</Label>
            <Select
              value={form.locale}
              onValueChange={(v) => v && setForm({ ...form, locale: v as Locale })}
              items={localeItems}
            >
              <SelectTrigger id="edit-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {localeItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {ta("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog({ sites, onClose }: { sites: { id: string; name: string }[]; onClose: () => void }) {
  const t = useTranslations("admin.users");
  const tl = useTranslations("locale");
  const ta = useTranslations("app");
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    locale: "he" as Locale,
    siteIds: sites.map((s) => s.id),
    asManager: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () =>
        inviteUserAction({
          email: form.email,
          fullName: form.fullName,
          locale: form.locale,
          siteIds: form.siteIds,
          role: form.asManager ? "SUPER_ADMIN" : "THERAPIST",
        }),
      {
        onSuccess: (r) => {
          toast.success(r.created ? t("created") : t("existed"));
          onClose();
          router.refresh();
        },
      },
    );
  };
  const localeItems = LOCALES.map((l) => ({ value: l, label: tl(l) }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">{t("email")}</Label>
            <Input
              id="inv-email"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">{t("name")}</Label>
            <Input
              id="inv-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-locale">{t("language")}</Label>
            <Select
              value={form.locale}
              onValueChange={(v) => v && setForm({ ...form, locale: v as Locale })}
              items={localeItems}
            >
              <SelectTrigger id="inv-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {localeItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("approveAt")}</legend>
            {sites.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.siteIds.includes(s.id)}
                  onCheckedChange={(v) =>
                    setForm({
                      ...form,
                      siteIds: v === true ? [...form.siteIds, s.id] : form.siteIds.filter((id) => id !== s.id),
                    })
                  }
                />
                {s.name}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.asManager} onCheckedChange={(v) => setForm({ ...form, asManager: v === true })} />
            {t("asManager")}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
