"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = { next: string; locale: string; initialError?: string };

export function LoginForm({ next, locale, initialError }: Props) {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, start] = useTransition();

  const google = () =>
    start(async () => {
      setError(undefined);
      const supabase = supabaseBrowser();
      const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}&locale=${locale}`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error) setError(t("error"));
    });

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(undefined);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError(t("invalidEmail"));
        return;
      }
      const supabase = supabaseBrowser();
      // The email carries a 6-digit code (custom template) and/or a magic link (default template);
      // both are accepted: the link lands on /api/auth/callback with a PKCE code.
      const emailRedirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}&locale=${locale}`;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } });
      if (error) setError(t("error"));
      else setStep("code");
    });
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(undefined);
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error) {
        setError(t("invalidCode"));
        return;
      }
      router.replace(`/${locale}${next}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={google} disabled={pending}>
        {t("google")}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {t("or")}
        <div className="h-px flex-1 bg-border" />
      </div>
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {t("sendCode")}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm">{t("codeSentTo", { email })}</p>
          <div className="space-y-1.5">
            <Label htmlFor="code">{t("codeLabel")}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {t("verify")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("email")} disabled={pending}>
            {t("changeEmail")}
          </Button>
        </form>
      )}
    </div>
  );
}
