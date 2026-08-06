// Protège tout ce qui est sous /dashboard : Clerk redirige vers /sign-in si
// l'utilisateur n'est pas connecté. Le reste (landing, pricing, webhooks) est
// public par défaut.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const estProtege = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (estProtege(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
