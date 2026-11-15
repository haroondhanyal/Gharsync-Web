import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GharSync — Your Home. Your Services. One Platform.",
  description: "Home services, organized around your life.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
