import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop Shot | Fortnite Item Shop Screenshot Generator",
  description: "Unofficial Fortnite item shop screenshot generator with V-Bucks and Birr cost estimates."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
