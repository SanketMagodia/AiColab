import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "AI Colab",
  description: "Team collaboration — scrum, notes, and shared drawing",
};

const themeInit = `(function(){try{var k='ai-colab-theme';var t=localStorage.getItem(k);if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);return;}if(window.matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.setAttribute('data-theme','light');else document.documentElement.setAttribute('data-theme','dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
