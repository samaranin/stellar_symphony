"use client";

import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-space-900 text-gray-100">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
