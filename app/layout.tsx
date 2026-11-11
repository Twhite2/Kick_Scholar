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
  // next/font has no metric overrides for this family yet, so name a plain
  // system fallback rather than a mis-sized adjusted one.
  adjustFontFallback: false,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

// Icons, manifest and the link-preview image come from the logo pack as
// file conventions in app/ (favicon.ico, icon.svg, apple-icon.png,
// manifest.webmanifest, opengraph-image.png, twitter-image.png).
export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { template: "%s | KickScholar", default: "KickScholar" },
  description: "Find universities and scholarships you actually qualify for.",
  applicationName: "KickScholar",
  openGraph: { siteName: "KickScholar", type: "website", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
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
