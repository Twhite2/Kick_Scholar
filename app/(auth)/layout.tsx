import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <div className="mb-8 text-xl font-semibold tracking-tight text-kick-blue">
        KickScholar
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
