import type { Metadata, Viewport } from "next";
import { ViewTransition } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppearanceProvider } from "./_components/AppearanceProvider";
import { CommandPalette } from "./_components/CommandPalette";
import { THEME_STORAGE_KEY } from "@/lib/themes";
import { COLOR_MODE_STORAGE_KEY } from "@/lib/colorMode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Marketing Platform",
    template: "%s · Marketing Platform",
  },
  description:
    "Plan campaigns, organize creative across every channel, build trackable links and QR codes, and watch performance in one place.",
  applicationName: "Marketing Platform",
  authors: [{ name: "Marketing Platform" }],
  openGraph: {
    type: "website",
    siteName: "Marketing Platform",
    title: "Marketing Platform",
    description:
      "Plan campaigns, organize creative across every channel, and track performance — in one place.",
  },
  twitter: {
    card: "summary",
    title: "Marketing Platform",
    description:
      "Plan campaigns, organize creative, and track performance — in one place.",
  },
  robots: {
    // Internal tool — keep it out of search indexes by default.
    index: false,
    follow: false,
  },
};

// In Next 16+, themeColor must live on the viewport export, not metadata.
// Applied to mobile browser chrome; users still see their picked palette
// inside the app via the AppearanceProvider.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Inline boot script — runs before paint to apply saved appearance preferences.
// Without this, every reload would flash the default palette/mode before React
// hydrates and the user's choices get re-applied.
const appearanceBootScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t&&t!=="slate")document.documentElement.setAttribute("data-theme",t);var m=localStorage.getItem(${JSON.stringify(
  COLOR_MODE_STORAGE_KEY
)})||"auto";var resolved=m==="auto"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.setAttribute("data-color-scheme",resolved);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The boot script sets data-theme + data-color-scheme on <html> before
      // React hydrates, so these attributes will differ from the SSR output.
      // suppressHydrationWarning is the canonical opt-out for this pattern
      // (used by next-themes and similar). Only suppresses the warning for
      // the html element itself, not its children.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppearanceProvider>
          <ViewTransition
            default="route-fade"
            enter={{
              "nav-forward": "nav-forward",
              "nav-back": "nav-back",
              default: "route-fade",
            }}
            exit={{
              "nav-forward": "nav-forward",
              "nav-back": "nav-back",
              default: "route-fade",
            }}
          >
            {children}
          </ViewTransition>
          <CommandPalette />
        </AppearanceProvider>
      </body>
    </html>
  );
}
