import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getActor } from "@/modules/auth/current";
import { Link } from "@/i18n/navigation";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, error } = await searchParams;
  const actor = await getActor();
  if (actor) redirect(`/${locale}${next && next.startsWith("/") ? next : "/calendar"}`);

  const t = await getTranslations("login");
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm next={next ?? "/calendar"} locale={locale} initialError={error ? t("error") : undefined} />
        <p className="text-xs text-muted-foreground text-center">
          {t.rich("legal", {
            terms: (c) => (
              <Link href="/terms" className="underline">
                {c}
              </Link>
            ),
            privacy: (c) => (
              <Link href="/privacy" className="underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
