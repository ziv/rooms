import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/routing";

/** OAuth (PKCE) callback. Email OTP is verified client-side and does not pass here. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(`/${locale}${next}`, url.origin));
  }
  return NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, url.origin));
}

function safeNext(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/calendar";
  return v;
}
