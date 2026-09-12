import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getActor } from "@/modules/auth/current";
import { Link } from "@/i18n/navigation";
import { Flowers, LogoMark } from "@/components/brand/flowers";
import { Card, CardContent } from "@/components/ui/card";

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
    <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl grid overflow-hidden rounded-3xl bg-card shadow-xl shadow-foreground/5 ring-1 ring-border lg:grid-cols-[1.1fr_1fr]">
        {/* Illustration panel */}
        <section className="relative flex flex-col justify-between gap-6 p-8 lg:p-10 bg-[#fefbf2]">
          {/*<div className="flex items-center gap-2 font-semibold tracking-tight">*/}
          {/*  <LogoMark className="size-8" />*/}
          {/*  <span>Rooms</span>*/}
          {/*</div>*/}
          <div className="space-y-2 max-w-sm">
            <h2 className="flex flex-row text-2xl font-semibold leading-snug lg:text-2xl text-[#43432d]">{t("tagline")}
            <img src="/flower.png" style={{ height: "40px" }} />
            </h2>
            <p className="text-md text-muted-foreground">{t("subtitle")}</p>
          </div>
          <img src="/rooms.png"/>
          {/*<Flowers className="max-w-md self-center lg:self-start -mb-4 lg:-mb-6 drop-shadow-[0_8px_16px_rgba(0,0,0,0.06)]" />*/}
        </section>

        {/* Form panel */}
        <section className="p-6 sm:p-10 flex items-center">
          <div className="w-full max-w-sm mx-auto space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("hint")}</p>
            </div>
            <Card className="shadow-none ring-0 bg-transparent p-0 [--card-spacing:0]">
              <CardContent className="p-0">
                <LoginForm next={next ?? "/calendar"} locale={locale} initialError={error ? t("error") : undefined} />
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
              {t.rich("legal", {
                terms: (c) => (
                  <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                    {c}
                  </Link>
                ),
                privacy: (c) => (
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                    {c}
                  </Link>
                ),
              })}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
