import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MIN_QUERY } from "@/lib/search/shared";
import { searchSuggestions } from "@/lib/search/suggest";

/**
 * Suggestions for the top-bar search: a few programmes, universities and
 * scholarships matching `q`, with how many each catalogue holds. Signed-in
 * students only, like the catalogues themselves.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Sign in to search." }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY) {
    return Response.json({ error: `Type at least ${MIN_QUERY} characters.` }, { status: 400 });
  }

  const suggestions = await searchSuggestions(prisma, q);
  return Response.json(suggestions, { headers: { "Cache-Control": "private, max-age=60" } });
}
