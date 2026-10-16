import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sparrow Media OS // Master Control",
  description: "Unified Media Operating System bridging physical hardware and agentic AI workflows",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-studio-950 text-slate-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
