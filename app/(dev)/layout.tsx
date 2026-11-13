import { notFound } from "next/navigation";
import { DataSaverProvider } from "@/components/kick/data-saver";
import { CompareProvider } from "@/components/kick/compare-tray";

/** Dev-only pages (the component kit). Never served in production. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <DataSaverProvider initialOn={false} hasChoice>
      <CompareProvider>
        <main>{children}</main>
      </CompareProvider>
    </DataSaverProvider>
  );
}
