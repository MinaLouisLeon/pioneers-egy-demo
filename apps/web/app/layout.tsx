import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@pioneers/ui/components/sonner";

import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Pioneers-EGY",
    template: "%s · Pioneers-EGY",
  },
  description: "Inspection job management and certificate register for Pioneers-EGY.",
  applicationName: "Pioneers-EGY",
  appleWebApp: {
    capable: true,
    title: "Pioneers-EGY",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom — pinching a defect photo on a phone is a real need, and
  // disabling it fails WCAG 1.4.4.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1f2a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton position="top-right" />
          <ServiceWorkerRegistration />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
