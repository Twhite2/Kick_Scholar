"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";

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
  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { name, email, passwordHash } });
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
      redirectTo: "/dashboard",
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
