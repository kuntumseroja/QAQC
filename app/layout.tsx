import type { Metadata } from "next";
import "./globals.css";
import Chrome from "@/components/chrome";

export const metadata: Metadata = {
  title: "QAQC4BI - AI-Powered QA/QC Platform",
  description: "AI-Powered QA/QC Automation for Bank Indonesia Payment System Data Infrastructure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full">
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
