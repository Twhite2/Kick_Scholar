import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Welcome back, {firstName}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Here&apos;s what you qualify for right now.
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Your match score, program and scholarship matches, and study-abroad
        journey will appear here once your profile and the opportunity
        catalog are in place.
      </div>
    </div>
  );
}
