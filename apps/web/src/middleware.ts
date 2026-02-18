export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    // 認証不要パスを除外: API routes, static files, login page
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
