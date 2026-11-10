import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { AdminTabs } from "@/components/admin/admin-tabs";

export const metadata: Metadata = { title: { template: "%s | Admin | KickScholar", default: "Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin routes require the ADMIN role, checked on the server — here and in
  // every admin page (see lib/auth-guards.ts for why both).
  await requireAdmin();

  return (
    <div className="box-content max-w-[1328px] px-gutter pt-6 pb-16 md:pt-10">
      <div className="mb-6">
        <h1 className="type-page-h1 text-ink">Admin</h1>
        <p className="mt-2 type-body-sm text-ink-3">Source health, crawl status and data quality.</p>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
