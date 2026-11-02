import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, createSessionToken, needsRenewal, readSession, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    const res = NextResponse.next();
    // Sliding renewal: a remembered login stays valid as long as the app is used at least once a month.
    if (needsRenewal(session)) res.cookies.set(SESSION_COOKIE, await createSessionToken(true), cookieOptions(true));
    return res;
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page/API, Next internals and static files.
  matcher: ["/((?!login|api/login|_next/|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
