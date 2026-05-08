import type { Metadata } from "next";
import { ToastProvider } from "@/components/feedback/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dial indoor",
  description: "Gerenciamento de mídias indoor para reprodutores Android TV",
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
    <html lang="pt-BR">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
