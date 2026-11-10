import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

// Two variable families, Latin only, swap so text shows immediately on a slow
// connection (docs/ui-remodel.md §5.3, §12.3).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"], // optical sizing keeps big titles tight
  variable: "--font-bricolage",
  display: "swap",
});

const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: { template: "%s | KickScholar", default: "KickScholar" },
  description: "Find universities and scholarships you actually qualify for.",
};

export const viewport: Viewport = {
  themeColor: "#071D33",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink" suppressHydrationWarning>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
