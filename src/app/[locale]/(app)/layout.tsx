import { setRequestLocale } from "next-intl/server";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Each page decides its own guard (onboarding pages must not require onboarding).
  return children;
}
