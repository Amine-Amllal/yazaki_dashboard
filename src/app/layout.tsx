import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { FeedbackProvider } from "@/components/ui/feedback-provider";

export const metadata: Metadata = {
  title: "YECMS - Yazaki Engineering Change Management",
  description: "DFC and ECO management platform - Yazaki Morocco Meknes",
  icons: {
    icon: [
      { url: "/yazaki-icon.svg", type: "image/svg+xml" },
      { url: "/yazaki-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: "/yazaki-icon.svg",
    apple: "/yazaki-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
