import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";
import { enforceRateLimit, RATE_LIMIT_POLICIES, rateLimitResponse } from "@/lib/security/rateLimit";

const nextAuthHandler = NextAuth(authOptions);

export async function POST(req: NextRequest, ctx: any) {
  const url = req.nextUrl?.pathname || req.url || '';

  // Protect credential authorization and sign-in attempts against brute force abuse
  if (url.includes('/callback/credentials') || url.includes('/signin')) {
    const rateLimitResult = await enforceRateLimit(req, {
      category: 'auth_signin',
      policy: RATE_LIMIT_POLICIES.AUTH,
    });

    if (!rateLimitResult.allowed) {
      return rateLimitResponse(
        rateLimitResult,
        "Too many sign-in attempts. Please wait a few moments before trying again."
      );
    }
  }

  return nextAuthHandler(req, ctx);
}

export { nextAuthHandler as GET };
