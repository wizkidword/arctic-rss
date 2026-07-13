import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { GoogleAnalytics } from "@/components/google-analytics";
import { GoogleAnalyticsScripts } from "@/components/google-analytics-scripts";
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
  description: "A calm, private RSS reader inspired by Google Reader.",
  metadataBase: getAppOrigin(),
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
        <GoogleAnalyticsScripts measurementId={googleAnalyticsMeasurementId} />
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={googleAnalyticsMeasurementId} />
        </Suspense>
      </body>
    </html>
  );
}
