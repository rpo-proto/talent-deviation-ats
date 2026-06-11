import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";
const clerkConfigured = Boolean(
  clerkPublishableKey.startsWith("pk_") && clerkSecretKey.startsWith("sk_")
);
const authRequired =
  process.env.TALENT_ATS_REQUIRE_AUTH === "true" ||
  (process.env.VERCEL === "1" && process.env.TALENT_ATS_ALLOW_UNAUTHENTICATED !== "true");

const authMiddleware = clerkConfigured
  ? clerkMiddleware(
      async (auth, req) => {
        if (isPublicRoute(req)) {
          return;
        }

        if (req.nextUrl.pathname.startsWith("/api/")) {
          const { userId } = await auth();

          if (!userId) {
            return NextResponse.json({ error: "Authentication required." }, { status: 401 });
          }

          return;
        }

        const { userId, redirectToSignIn } = await auth();

        if (!userId) {
          return redirectToSignIn({ returnBackUrl: req.url });
        }
      },
      {
        afterSignInUrl: "/",
        afterSignUpUrl: "/",
        signInUrl: "/sign-in",
        signUpUrl: "/sign-up"
      }
    )
  : undefined;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!authRequired) {
    return NextResponse.next();
  }

  if (authRequired && !clerkConfigured && !isPublicRoute(req)) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Clerk is required but not configured for this deployment." },
        { status: 503 }
      );
    }

    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

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
