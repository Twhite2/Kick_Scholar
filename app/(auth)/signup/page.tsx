import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { WaitlistForm } from "@/components/auth/waitlist-form";
import { signupMode } from "@/lib/waitlist/core";
import { findUsableInvite } from "@/lib/waitlist/invites";
import { waitlistFormProps } from "@/lib/waitlist/form-props";

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export async function generateMetadata(): Promise<Metadata> {
  return { title: signupMode() === "invite" ? "Join the waitlist" : "Create your account" };
}

/**
 * Sign-up, or the waitlist while SIGNUP_MODE=invite. Every "Sign up" link on
 * the site points here, so switching modes needs no other change; an invite
 * link (/signup?invite=…) opens the account form for that invite.
 */
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const next = param(params.next);
  const token = param(params.invite);

  const invite = token ? await findUsableInvite(token) : null;
  if (invite) return <SignupForm next={next} invite={{ token, email: invite.email }} />;

  if (signupMode() === "invite") {
    return (
      <WaitlistForm
        {...waitlistFormProps(params)}
        notice={token ? "That invite link has expired or has already been used. Join again below and we'll send you a new one." : undefined}
      />
    );
  }
  return <SignupForm next={next} />;
}
