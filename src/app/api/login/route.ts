import { NextResponse } from "next/server";
import { checkPassword, cookieOptions, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: unknown; remember?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  const remember = body.remember !== false; // default on
  if (!password || !(await checkPassword(password))) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(remember), cookieOptions(remember));
  return res;
}
