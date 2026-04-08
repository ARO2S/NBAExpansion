import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "NBA Expansion Draft Simulator",
  description: "Simulate drafting an NBA expansion team under configurable rules",
  openGraph: {
    title: "NBA Expansion Draft Simulator",
    description: "Simulate drafting an NBA expansion team under configurable rules",
    url: "https://www.nbaexpansion.com",
    siteName: "NBA Expansion Draft Simulator",
    images: [
      {
        url: "/ogimage.png",
        width: 1200,
        height: 630,
        alt: "NBA Expansion Draft Simulator",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NBA Expansion Draft Simulator",
    description: "Simulate drafting an NBA expansion team under configurable rules",
    images: ["/ogimage.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
