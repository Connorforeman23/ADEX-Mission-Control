import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import DevBanner from "@/components/DevBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ADEX Mission Control",
  description: "Advertising Excellence — agency operations",
  // Installing the site as an app: the manifest is generated in manifest.ts,
  // and iOS ignores it, reading these two instead.
  appleWebApp: { capable: true, title: "ADEX", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // Matches the manifest, so the installed window and the browser agree.
  themeColor: "#2e6bff",
  // The shell scrolls its own panes; stopping the page itself from zooming
  // keeps a phone from drifting sideways on a wide table.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before paint, avoiding a flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('adex-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        <DevBanner />
        {children}
      </body>
    </html>
  );
}
