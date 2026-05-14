import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Truncated tag so the same code is recognizable across log lines without
  // dumping the full single-use token to the terminal.
  const tag = code ? code.slice(0, 8) : "(no-code)";
  console.log(
    `[auth/callback] hit code=${tag} next=${next} providerError=${error ?? "-"}`
  );

  if (error) {
    console.warn(
      `[auth/callback] ${tag} provider returned error: ${errorDescription ?? error}`
    );
    const target = new URL("/login", origin);
    target.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(target);
  }

  if (!code) {
    console.warn(`[auth/callback] ${tag} no code in query — redirecting to /login`);
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = await createClient();

  // Google's OAuth code is single-use. If the callback URL is hit twice
  // (prefetch, refresh, back-button), the second exchange fails with
  // "Unable to exchange external code". Skip the exchange when a session
  // already exists from the first hit.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    console.log(
      `[auth/callback] ${tag} session already exists (user=${user.id}) — skipping exchange, redirecting to ${next}`
    );
    return NextResponse.redirect(new URL(next, origin));
  }

  console.log(`[auth/callback] ${tag} no session — calling exchangeCodeForSession`);

  try {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(
        `[auth/callback] ${tag} exchange failed: ${exchangeError.message}`
      );
      const target = new URL("/login", origin);
      target.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(target);
    }
  } catch (err) {
    console.error(`[auth/callback] ${tag} exchangeCodeForSession threw:`, err);
    const target = new URL("/login", origin);
    target.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(target);
  }

  console.log(`[auth/callback] ${tag} exchange OK — redirecting to ${next}`);
  return NextResponse.redirect(new URL(next, origin));
}
