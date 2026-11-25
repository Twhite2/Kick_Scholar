import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WaitlistForm } from "@/components/auth/waitlist-form";
import { signupMode } from "@/lib/waitlist/core";
import { waitlistFormProps } from "@/lib/waitlist/form-props";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description:
    "VarsityFind is opening to students a few at a time. Join the waitlist to be among the first to see the programmes and scholarships abroad you qualify for.",
  alternates: { canonical: "/waitlist" },
};

/** A shareable address for the waitlist. While sign-up is open there is nothing to wait for. */
export default async function WaitlistPage({ searchParams }: PageProps<"/waitlist">) {
  if (signupMode() !== "invite") redirect("/signup");
  return <WaitlistForm {...waitlistFormProps(await searchParams)} />;
}
