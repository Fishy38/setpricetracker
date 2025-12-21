// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import CategoryMenu from "@/app/components/CategoryMenu";

export const metadata: Metadata = {
  title: "SetPriceTracker",
  description: "Track LEGO set prices across major retailers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <CategoryMenu />
        {children}
      </body>
    </html>
  );
}