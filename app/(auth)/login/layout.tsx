import type { Metadata } from "next";

// Not a page to land on from search; its links still count.
export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
