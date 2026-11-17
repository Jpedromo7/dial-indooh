import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/feedback/toast";
import { SessionProvider } from "@/components/layout/session-context";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: {
    icon: [
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: "/brand/apple-touch-icon.png"
  },
  appleWebApp: { title: BRAND.name, capable: true, statusBarStyle: "black-translucent" }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FC" },
    { media: "(prefers-color-scheme: dark)", color: BRAND.colors.background }
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // A classe "dark" é definida pelo ThemeScript antes da hidratação.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <SessionProvider>{children}</SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
