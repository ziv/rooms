import { redirect } from "next/navigation";

/** Locale root: the calendar index decides where the user belongs (calendar, onboarding, or login via proxy). */
export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/calendar`);
}
