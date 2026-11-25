import type { Metadata } from "next";

// Search should land on /waitlist (or the home page), not here; its links still count.
export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: true } };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
