import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that should NOT be protected by Clerk
const isPublicRoute = createRouteMatcher([
  "/",
  // Auth APIs (custom JWT auth) must be public so they can return JSON
  "/api/auth(.*)",

  // Auth pages (route groups are not part of the URL)
  "/agency/sign-in(.*)",
  "/agency/sign-up(.*)",
  "/agency/forgot-password(.*)",
  "/agency/reset-password(.*)",

  // SSO callback for OAuth (Google, Apple, etc.)
  "/sso-callback(.*)",

  // all UploadThing routes are public
  "/api/uploadthing(.*)",
]);

// Auth pages where signed-in users should be redirected away
const isAuthPage = createRouteMatcher([
  "/agency/sign-in(.*)",
  "/agency/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const session = await auth();

  // If user is already signed in and trying to access auth pages, redirect to dashboard
  if (session.userId && isAuthPage(request)) {
    const url = new URL("/agency", request.url);
    return NextResponse.redirect(url);
  }

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    if (!session.userId) {
      return session.redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Run middleware for all routes EXCEPT static files + _next/*
    "/((?!_next|.*\\..*).*)",

    // Always run on API & tRPC routes
    "/(api|trpc)(.*)",
  ],
};
