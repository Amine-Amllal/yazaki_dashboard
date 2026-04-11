import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

export const metadata: Metadata = {
  title: "YECMS - Yazaki Engineering Change Management",
  description: "DFC and ECO management platform - Yazaki Morocco Meknes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
