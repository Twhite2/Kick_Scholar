import { auth } from "@/lib/auth";

/**
 * The role check for admin server actions. Pages use requireAdmin from
 * lib/auth-guards (which redirects); an action is called directly by its id,
 * so it must refuse on its own, and throwing is the right answer there.
 *
 * Kept out of the "use server" files so it isn't itself exposed as an action.
 */
export async function requireAdminAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session.user;
}
