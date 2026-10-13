import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alumnity · HKBK College of Engineering alumni",
  description: "A place for HKBK College of Engineering students and alumni to ask, guide and grow together."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
