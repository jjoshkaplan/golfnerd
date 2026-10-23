import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase session cookie and gates the signed-in pages.
 * Runs only on those paths, and skips entirely when Supabase isn't configured
 * so /, /demo and /login work with no env at all.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith("/demo")) return response;
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/demo";
    redirect.searchParams.set("nosupabase", "1");
    return NextResponse.redirect(redirect);
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return NextResponse.redirect(login);
  }
  return response;
}

// Next parses this statically: it must be a literal array, not an expression.
export const config = { matcher: ["/sessions/:path*", "/upload/:path*", "/compare/:path*"] };