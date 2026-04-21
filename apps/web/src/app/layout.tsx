import type { Metadata } from "next";
import { ToastProvider } from "@/components/feedback/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dial Indooh",
  description: "Indoor media management for Android TV signage boxes",
  icons: {
    apple: "/brand/dial-indooh-logo.png",
    icon: "/brand/dial-indooh-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
