import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Admin pages call this themselves, before touching any data.
 *
 * The admin layout checks too, but a layout's redirect doesn't stop its page
 * from rendering: layouts and pages render in parallel, and once a loading
 * boundary has started streaming, the page's output is already on its way.
 * Each page that reads admin-only data must therefore refuse on its own.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session;
}
