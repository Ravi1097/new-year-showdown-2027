import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "New Year Showdown 2027",
  description: "One Night. Four Teams. 75 Questions. One Champion."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
