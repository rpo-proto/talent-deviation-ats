import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";
const clerkConfigured = Boolean(
  clerkPublishableKey.startsWith("pk_") && clerkSecretKey.startsWith("sk_")
);

const authMiddleware = clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isPublicRoute(req)) {
        return;
      }

      await auth.protect();
    })
  : undefined;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!authMiddleware) {
    return NextResponse.next();
  }

  return authMiddleware(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
