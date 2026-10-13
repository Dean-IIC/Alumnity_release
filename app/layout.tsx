import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alumnity · HKBK Alumni Network",
  description: "A place for HKBK people to ask, guide and grow together."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
