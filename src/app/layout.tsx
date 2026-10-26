import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { SerwistProvider } from "@serwist/turbopack/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Blocky display font for page titles ("DASHBOARD", "SAVE TOGETHER"), as in the mockups and logo.
// Capitals and digits only, so use it with `uppercase`. Credited in Settings (CC BY 4.0, onlinewebfonts.com).
const aubette = localFont({
  src: "./fonts/architype-aubette-w90.woff2",
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Kalupi",
  applicationName: "Kalupi",
  description: "Personal budget and savings tracker",
  // iOS home-screen app: full screen, no Safari bars
  appleWebApp: { capable: true, title: "Kalupi", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7fe" },
    { media: "(prefers-color-scheme: dark)", color: "#12101f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${aubette.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* Off in dev so stale caches don't hide changes. No reload on reconnect: sync catches up instead */}
          <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"} reloadOnOnline={false}>
            {children}
          </SerwistProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
