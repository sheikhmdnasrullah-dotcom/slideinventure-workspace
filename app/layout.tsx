import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SlideIn Venture — Ops Console",
  description: "SlideIn Venture operations dashboard",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* day → no class; night → .dark on <html>. next-themes persists the
            choice and applies it before paint (suppressHydrationWarning
            acknowledges that the class is set on the client). */}
        <ThemeProvider
          attribute="class"
          defaultTheme="day"
          enableSystem={false}
          disableTransitionOnChange
          value={{ day: "light", night: "dark" }}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
