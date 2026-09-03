import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/routing";

/** OAuth (PKCE) callback, and server-side verification of email links (token_hash). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await supabaseServer();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(`/${locale}${next}`, url.origin));
  } else if (tokenHash && (type === "magiclink" || type === "email")) {
    // Server-side verification of an email link ({{ .TokenHash }}); no code verifier needed.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(new URL(`/${locale}${next}`, url.origin));
  }
  return NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, url.origin));
}

function safeNext(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/calendar";
  return v;
}
