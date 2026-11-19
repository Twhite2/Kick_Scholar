"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/admin/require-admin-action";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import {
  MAX_JOINS_PER_IP_PER_HOUR,
  WAITLIST_DEGREES,
  clientIp,
  generateInviteToken,
  hashInviteToken,
  hashIp,
  inviteExpiry,
  invitePath,
  waitlistFormValues,
  waitlistInputSchema,
} from "@/lib/waitlist/core";

export type WaitlistActionState =
  | { joined: true; email: string }
  | { joined?: false; error?: string; fieldErrors?: Record<string, string> }
  | undefined;

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === "P2002";

/**
 * Adds a student to the waitlist.
 *
 * The answer is the same whether the email is new, already waiting, or
 * already has an account, so the form can't be used to find out who has
 * signed up. For the same reason an existing entry is never updated: anyone
 * could otherwise rewrite someone else's answers by typing their email.
 */
export async function joinWaitlist(_prev: WaitlistActionState, formData: FormData): Promise<WaitlistActionState> {
  // A field people never see; bots that fill every input fill this one too.
  // They get the normal confirmation, so they don't learn to skip it.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim()) {
    return { joined: true, email: String(formData.get("email") ?? "") };
  }

  const parsed = waitlistInputSchema.safeParse(waitlistFormValues(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const input = parsed.data;
  const joined = { joined: true as const, email: input.email };

  try {
    const ipHash = hashIp(clientIp(await headers()));
    if (ipHash) {
      const recent = await prisma.waitlistEntry.count({
        where: { ipHash, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      });
      if (recent >= MAX_JOINS_PER_IP_PER_HOUR) {
        return { error: "Too many sign-ups from this network in the last hour. Please try again later." };
      }
    }

    const hasAccount = await prisma.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (hasAccount) return joined;

    await prisma.waitlistEntry.create({
      data: {
        email: input.email,
        desiredDegreeLevel: input.desiredDegreeLevel,
        preferredCountries: input.preferredCountries,
        nationality: input.nationality,
        source: input.source,
        ipHash,
      },
    });
    return joined;
  } catch (err) {
    if (isUniqueViolation(err)) return joined; // already on the list
    console.error("[waitlist] join failed:", err);
    return { error: "We couldn't add you right now. Please try again in a moment." };
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface IssuedInvite {
  id: string;
  email: string;
  /** Site-relative; the admin page prefixes its own origin. */
  path: string;
}

const inviteNextSchema = z.object({
  count: z.number().int().min(1).max(200),
  degree: z.enum(WAITLIST_DEGREES).nullable(),
  country: z
    .string()
    .refine((c) => c in TARGET_COUNTRIES)
    .nullable(),
});

/** Gives an entry a fresh link. Any link it had before stops working. */
async function issueInvite(id: string, allowFrom: Array<"WAITING" | "INVITED">): Promise<IssuedInvite | null> {
  const token = generateInviteToken();
  const now = new Date();
  // updateMany with the status in the filter, so two admins inviting at once
  // can't both hand out a link for the same person.
  const { count } = await prisma.waitlistEntry.updateMany({
    where: { id, status: { in: allowFrom } },
    data: { status: "INVITED", inviteTokenHash: hashInviteToken(token), invitedAt: now, inviteExpiresAt: inviteExpiry(now) },
  });
  if (count === 0) return null;
  const entry = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id }, select: { email: true } });
  return { id, email: entry.email, path: invitePath(token) };
}

/** Invites the longest-waiting students, optionally only those aiming for a given degree or country. */
export async function adminInviteNext(input: { count: number; degree: string | null; country: string | null }): Promise<IssuedInvite[]> {
  await requireAdminAction();
  const { count, degree, country } = inviteNextSchema.parse(input);

  const candidates = await prisma.waitlistEntry.findMany({
    where: {
      status: "WAITING",
      ...(degree ? { desiredDegreeLevel: degree } : {}),
      ...(country ? { preferredCountries: { has: country } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: count,
    select: { id: true },
  });

  const issued: IssuedInvite[] = [];
  for (const { id } of candidates) {
    const invite = await issueInvite(id, ["WAITING"]);
    if (invite) issued.push(invite);
  }
  revalidatePath("/admin/waitlist");
  return issued;
}

/** Invites one student, or makes a new link for one already invited (the old link stops working). */
export async function adminInviteEntry(id: string): Promise<IssuedInvite | null> {
  await requireAdminAction();
  const invite = await issueInvite(z.string().min(1).parse(id), ["WAITING", "INVITED"]);
  revalidatePath("/admin/waitlist");
  return invite;
}

/** Deletes an entry outright, for someone who asks to be taken off the list. */
export async function adminDeleteEntry(id: string): Promise<void> {
  await requireAdminAction();
  await prisma.waitlistEntry.deleteMany({ where: { id: z.string().min(1).parse(id) } });
  revalidatePath("/admin/waitlist");
}
