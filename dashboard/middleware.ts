import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAuthed, passwordConfigured } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!passwordConfigured) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  if (await isAuthed(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon.png|apple-touch-icon.png|logo.png).*)"],
};
