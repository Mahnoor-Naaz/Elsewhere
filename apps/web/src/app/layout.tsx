import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elsewhere",
  description: "An archive for fictional worlds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
