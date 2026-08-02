import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flappy World — Flappy Bird Remake",
  description: "A Flappy Bird-style game built with Next.js and Canvas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
