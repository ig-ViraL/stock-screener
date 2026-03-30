import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { MarketStatus, MarketStatusSkeleton } from "@/components/MarketStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stock Screener",
  description: "Real-time market data and stock screening",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Read localStorage before first paint to avoid theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-full overflow-hidden flex flex-col bg-[#0a0a0a] text-zinc-100">
        <header className="shrink-0 border-b border-zinc-800 bg-[#0f0f0f] px-6 py-4">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Stock Screener</h1>
              <p className="text-sm text-zinc-500">Real-time market data for 25 stocks</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Suspense fallback={<MarketStatusSkeleton />}>
                <MarketStatus />
              </Suspense>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
