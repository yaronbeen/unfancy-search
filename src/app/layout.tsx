import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "unfancy — You don't need a fancy search API",
  description:
    "A full-featured search engine built with Bright Data SERP retrieval, Claude AI query expansion, and RRF reranking. No fancy vendor required.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "unfancy — You don't need a fancy search API",
    description:
      "Build your own search pipeline with Bright Data SERP + Claude AI + RRF. ~$0.003/query vs $0.01–$0.05 for fancy APIs.",
    url: "https://unfancy-search.yaron-been.workers.dev",
    siteName: "unfancy",
    images: [
      {
        url: "https://unfancy-search.yaron-been.workers.dev/og-image.svg",
        width: 1200,
        height: 630,
        alt: "unfancy — You don't need a fancy search API",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "unfancy — You don't need a fancy search API",
    description:
      "Build your own search pipeline with Bright Data SERP + Claude AI + RRF. ~$0.003/query vs $0.01–$0.05 for fancy APIs.",
    images: ["https://unfancy-search.yaron-been.workers.dev/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        {children}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
