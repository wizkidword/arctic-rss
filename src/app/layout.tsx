import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AnalyticsConsent } from "@/components/analytics-consent";
import { getAppOrigin } from "@/lib/app-origin";
import { getGoogleAnalyticsMeasurementId } from "@/lib/google-analytics";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arctic RSS",
  description: "A calm, browser-based RSS reader for following the open web.",
  metadataBase: getAppOrigin(),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleAnalyticsMeasurementId = getGoogleAnalyticsMeasurementId();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AnalyticsConsent measurementId={googleAnalyticsMeasurementId} />
      </body>
    </html>
  );
}
