import { prisma } from "@/lib/db";
import { hashInviteToken } from "./core";

export interface UsableInvite {
  id: string;
  email: string;
}

/**
 * The waitlist entry an invite link belongs to, if the link still works:
 * the entry is INVITED (not yet used) and the link hasn't expired. A token
 * that was reissued no longer matches, since only the newest hash is kept.
 */
export async function findUsableInvite(token: string | null | undefined, now: Date = new Date()): Promise<UsableInvite | null> {
  if (!token || token.length > 200) return null;
  const entry = await prisma.waitlistEntry.findUnique({
    where: { inviteTokenHash: hashInviteToken(token) },
    select: { id: true, email: true, status: true, inviteExpiresAt: true },
  });
  if (!entry || entry.status !== "INVITED") return null;
  if (!entry.inviteExpiresAt || entry.inviteExpiresAt <= now) return null;
  return { id: entry.id, email: entry.email };
}
