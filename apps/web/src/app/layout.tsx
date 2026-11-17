import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "GharSync — Your Home. Your Services. One Platform.",
  description: "A Pakistan-first home care and field service platform for customers, technicians and service businesses.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: { title: "GharSync — Home care, finally in sync", description: "Keep homes, service requests, trusted professionals and business operations in one place.", siteName: "GharSync", type: "website", locale: "en_PK" },
  twitter: { card: "summary_large_image", title: "GharSync — Your Home. Your Services. One Platform.", description: "Home care and local service operations, organized in one place." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
