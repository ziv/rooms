"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function signOutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}
