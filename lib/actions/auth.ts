"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { signIn, signOut } from "@/lib/auth";
import { normalizeEmail, signupMode } from "@/lib/waitlist/core";
import { findUsableInvite } from "@/lib/waitlist/invites";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type AuthActionState = { error?: string } | undefined;

/**
 * Where to go after signing in. Only same-site paths are honoured, so a
 * crafted ?next=https://evil.example can't turn sign-in into an open redirect.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, password } = parsed.data;
  let { email } = parsed.data;

  try {
    // While sign-up is invite-only (SIGNUP_MODE=invite), an account needs a
    // working invite link, and is made for the email the invite went to.
    const inviteToken = formData.get("invite");
    const invite = await findUsableInvite(typeof inviteToken === "string" ? inviteToken : null);
    if (signupMode() === "invite" && !invite) {
      return {
        error: inviteToken
          ? "This invite link has expired or has already been used. Join the waitlist and we'll send you a new one."
          : "VarsityFind is invite-only for now. Join the waitlist to get an invite.",
      };
    }
    if (invite) {
      email = invite.email;
      formData.set("email", invite.email); // login() below reads it from here
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      // Whoever was waiting under this email has now joined, invited or not.
      // The link is spent: clearing its hash means it can't be used twice.
      await tx.waitlistEntry.updateMany({
        where: { email: normalizeEmail(email), status: { not: "JOINED" } },
        data: { status: "JOINED", joinedAt: new Date(), userId: user.id, inviteTokenHash: null },
      });
    });
    // Sent once the response is on its way: a slow or failed email never
    // holds up or breaks signing up.
    after(() => sendEmail({ to: email, toName: name, tag: "welcome", ...welcomeEmail({ name, email }) }));
  } catch (error) {
    // Previously this threw straight through and rendered a 500 error page.
    console.error("[auth] signup failed:", error);
    return {
      error: "We couldn't create your account right now — please try again in a moment.",
    };
  }

  return login(_prevState, formData);
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeNext(formData.get("next")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // CredentialsSignin is the only AuthError that actually means the email
      // or password was wrong. Everything else — most often the database being
      // unreachable — is a fault on our side, and saying "invalid password"
      // for it is both untrue and actively misleading.
      if (error.type === "CredentialsSignin") {
        return { error: "Invalid email or password" };
      }
      console.error("[auth] sign-in failed for a non-credential reason:", error);
      return {
        error: "We couldn't sign you in right now — please try again in a moment.",
      };
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
