import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "Data Quality" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/crawl-jobs", label: "Crawl Jobs" },
  { href: "/admin/verification", label: "Verification Queue" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Admin</h1>
        <p className="mt-1 text-muted-foreground">Source health, crawl status, and data quality.</p>
      </div>
      <nav className="mb-8 flex gap-1 border-b border-border">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
