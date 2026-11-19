import { createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { countryNameOptions } from "@/lib/ui/country";
import { ISO_COUNTRY_CODES } from "@/lib/ui/iso-countries";
import { MAX_WAITLIST_COUNTRIES, WAITLIST_DEGREES } from "./constants";

/**
 * The waitlist's pure parts: sign-up mode, form validation, invite tokens and
 * IP hashing. Nothing here touches the database, so it is unit-tested
 * directly (lib/waitlist/__tests__); lib/waitlist/invites.ts and
 * lib/actions/waitlist.ts do the queries.
 */

export type SignupMode = "open" | "invite";

/**
 * SIGNUP_MODE=invite closes sign-up to everyone without an invite link, and
 * sends them to the waitlist instead. Anything else (or unset) keeps sign-up
 * open, so deployments that never set it behave as before.
 */
export function signupMode(env: Record<string, string | undefined> = process.env): SignupMode {
  return env.SIGNUP_MODE?.trim().toLowerCase() === "invite" ? "invite" : "open";
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** How long an invite link works for. */
export const INVITE_TTL_DAYS = 30;

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** 32 random bytes, URL-safe. Only its hash is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Tokens are already high-entropy, so a plain SHA-256 is enough: the point is
 * that a leaked database row can't be turned back into a working link.
 */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const invitePath = (token: string) => `/signup?invite=${encodeURIComponent(token)}`;

/**
 * The first address in X-Forwarded-For (the client, as the proxy saw it),
 * else X-Real-IP. Behind no proxy both are absent and this returns null.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

/**
 * Keyed with AUTH_SECRET so the stored value can't be reversed by hashing
 * all 4 billion IPv4 addresses. Without a secret nothing is stored.
 */
export function hashIp(ip: string | null, secret: string | undefined = process.env.AUTH_SECRET): string | null {
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(`waitlist-ip:${ip}`).digest("hex");
}

/** Sign-ups allowed from one network per hour before the form refuses. */
export const MAX_JOINS_PER_IP_PER_HOUR = 5;

export { WAITLIST_DEGREES, MAX_WAITLIST_COUNTRIES };

const NATIONALITIES = new Set(countryNameOptions(ISO_COUNTRY_CODES));

export const waitlistInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254).transform(normalizeEmail),
  desiredDegreeLevel: z.enum(WAITLIST_DEGREES, { message: "Choose the degree you're aiming for" }),
  preferredCountries: z
    .array(z.string().refine((code) => code in TARGET_COUNTRIES, "Unknown country"))
    .max(MAX_WAITLIST_COUNTRIES, `Choose up to ${MAX_WAITLIST_COUNTRIES} countries`)
    .transform((codes) => [...new Set(codes)]),
  nationality: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .refine((v) => v === null || NATIONALITIES.has(v), "Choose a country from the list"),
  source: z
    .string()
    .trim()
    .transform((v) => v.slice(0, 100) || null)
    .nullable(),
});

export type WaitlistInput = z.output<typeof waitlistInputSchema>;

/** Reads the waitlist form's FormData into the shape the schema expects. */
export function waitlistFormValues(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : null;
  };
  return {
    email: str("email") ?? "",
    desiredDegreeLevel: str("desiredDegreeLevel") ?? "",
    preferredCountries: formData.getAll("preferredCountries").filter((v): v is string => typeof v === "string"),
    nationality: str("nationality"),
    source: str("source"),
  };
}
