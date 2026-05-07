import type { Metadata } from "next";
import { ViewTransition } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppearanceProvider } from "./_components/AppearanceProvider";
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
  // Theme color is applied to mobile browser chrome. Defaults to the slate
  // accent; users still see their chosen palette inside the app.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
      </head>
      <body className="min-h-full flex flex-col">
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
        </AppearanceProvider>
      </body>
    </html>
  );
}
