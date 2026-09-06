import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, dirFor } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { Pwa } from "@/components/layout/pwa";
import { NavigationPendingProvider } from "@/components/layout/navigation-pending";

export const metadata: Metadata = {
  title: { default: "Rooms", template: "%s · Rooms" },
  description: "Therapy room scheduler",
  appleWebApp: { capable: true, title: "Rooms", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport = { themeColor: "#111111", width: "device-width", initialScale: 1 };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} dir={dirFor(locale)} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <NavigationPendingProvider>{children}</NavigationPendingProvider>
          <Pwa />
          <Toaster position={dirFor(locale) === "rtl" ? "top-left" : "top-right"} richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
