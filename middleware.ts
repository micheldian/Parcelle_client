/**
 * Middleware d'authentification : toutes les pages et API sont protégées,
 * sauf /login et les routes NextAuth.
 */
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    // Tout protéger sauf : routes NextAuth, page de login, assets Next, favicon
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
