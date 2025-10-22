import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: Request) {
  const url = new URL(req.url);
  const isApi = url.pathname.startsWith("/api");
  const isAuth = url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/login");

  // Public: Login/Auth
  if (isAuth) return NextResponse.next();

  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    // Allow unauthenticated access to pages and GET APIs
    const method = (req as any).method as string;
    if (isApi && ["POST","PUT","PATCH","DELETE"].includes(method)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // API write methods only for admin|vertrieb
  const method = (req as any).method as string;
  if (isApi && ["POST","PUT","PATCH","DELETE"].includes(method)) {
    if ((token as any).role !== "admin" && (token as any).role !== "vertrieb") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
