import type { Metadata } from "next";
import { Fragment_Mono, Host_Grotesk, Michroma, Noto_Sans } from "next/font/google";
import "./globals.css";
import { env } from "@/config/env";
import { cn } from "cn";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { I18nProvider } from "./_i18n/i18n-provider";
import { getLocale, getMessages } from "./_i18n/server";

// Fallback for the characters Pretendard and Pretendard JP lack (other scripts); app/shared.css lists
// --font-noto-sans after them. Not preloaded, so a page downloads it only when it shows such characters.
const notoSans = Noto_Sans({ variable: "--font-noto-sans", preload: false, adjustFontFallback: false });

// Interface fonts from the Figma design ("HEIMDALLR UI"): a wide face for the wordmark, a monospace for tabs and data,
// a grotesk for interface text. Only elements with font-display, font-data or font-ui use them.
const display = Michroma({ variable: "--font-display-face", weight: "400", subsets: ["latin"] });
const data = Fragment_Mono({ variable: "--font-data-face", weight: "400", subsets: ["latin"] });
const ui = Host_Grotesk({ variable: "--font-ui-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s | ${env.appName}` },
  description: "Full-stack web application built on the Next.js App Router",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The language comes from a cookie (decision #56), so every page renders on request.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={cn("h-full", "antialiased", "font-sans", notoSans.variable, display.variable, data.variable, ui.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {/* One toast viewport for the whole app; client code shows a toast with `toast.add()` from components/ui/toast. */}
            <Toaster>
              <I18nProvider locale={locale} messages={getMessages(locale)}>
                <TooltipProvider>{children}</TooltipProvider>
              </I18nProvider>
            </Toaster>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
