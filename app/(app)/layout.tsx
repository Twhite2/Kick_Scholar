import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDataSaver, hasDataSaverChoice } from "@/lib/ui/data-saver";
import { AppShell } from "@/components/kick/app-shell/app-shell";
import { DataSaverProvider } from "@/components/kick/data-saver";
import { CompareProvider, CompareTray } from "@/components/kick/compare-tray";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Every route in the signed-in zone checks the session on the server.
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [dataSaver, hasChoice] = await Promise.all([getDataSaver(), hasDataSaverChoice()]);

  return (
    <DataSaverProvider initialOn={dataSaver} hasChoice={hasChoice}>
      <CompareProvider>
        <AppShell
          user={{
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            isAdmin: session.user.role === "ADMIN",
          }}
        >
          {children}
        </AppShell>
        <CompareTray />
      </CompareProvider>
    </DataSaverProvider>
  );
}
