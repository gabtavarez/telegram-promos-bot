import { NextResponse } from "next/server";
import { SESSION_COOKIE, passwordMatches, sessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!(await passwordMatches(String(body.password ?? "")))) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, (await sessionToken())!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
