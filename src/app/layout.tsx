import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/theme";
import { THEME_BOOT } from "@/lib/viz/themeBoot";

export const metadata: Metadata = {
  title: "golfnerds",
  description: "Upload your launch monitor sessions and see what actually changed between them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <main>
          <header className="site">
            <Link className="brand" href="/">golfnerds</Link>
            <nav>
              <Link href="/demo">Demo</Link>
              <Link href="/sessions">Sessions</Link>
              <Link href="/upload">Upload</Link>
              <Link href="/compare">Compare</Link>
            </nav>
            <ThemeToggle />
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
