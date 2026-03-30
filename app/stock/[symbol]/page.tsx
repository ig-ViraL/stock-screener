import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { STOCK_SYMBOLS } from "@/lib/symbols";
import { getStockProfile, getStockDetail, getBasicFinancials } from "@/lib/finnhub";
import { StockDetailHeader } from "@/components/stock-detail/StockDetailHeader";
import { KeyMetrics } from "@/components/stock-detail/KeyMetrics";
import { CompanyProfile } from "@/components/stock-detail/CompanyProfile";
import { AnalystRecommendations } from "@/components/stock-detail/AnalystRecommendations";
import { NewsSection } from "@/components/stock-detail/NewsSection";
import {
  MetricsSkeleton,
  ProfileSkeleton,
  RecommendationSkeleton,
  NewsSkeleton,
} from "@/components/stock-detail/StockDetailSkeleton";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  try {
    const profile = await getStockProfile(upper); // 7d cache
    return {
      title: `${upper} — ${profile.name} | Stock Screener`,
      description: `Live price, key metrics, analyst recommendations, and news for ${profile.name} (${upper})`,
    };
  } catch {
    return { title: `${upper} | Stock Screener` };
  }
}

/**
 * Fetches quote (fresh) + financials (1d cache) for the header.
 * Defined inline so notFound() can be called if the stock doesn't exist.
 */
async function HeaderSection({ symbol }: { symbol: string }) {
  const [stock, financials] = await Promise.all([
    getStockDetail(symbol),
    getBasicFinancials(symbol).catch(() => null),
  ]);

  if (!stock) notFound();

  return <StockDetailHeader stock={stock} financials={financials} />;
}

export default async function StockDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  if (!(STOCK_SYMBOLS as readonly string[]).includes(upper)) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Screener
      </Link>

      <div className="space-y-6">
        {/* Sticky header — stays visible while rest of page scrolls */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a] pb-2">
          <Suspense fallback={<MetricsSkeleton />}>
            <HeaderSection symbol={upper} />
          </Suspense>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* These sections stream independently — all data is cached */}
          <Suspense fallback={<MetricsSkeleton />}>
            <KeyMetrics symbol={upper} />
          </Suspense>

          <div className="space-y-6">
            <Suspense fallback={<ProfileSkeleton />}>
              <CompanyProfile symbol={upper} />
            </Suspense>

            <Suspense fallback={<RecommendationSkeleton />}>
              <AnalystRecommendations symbol={upper} />
            </Suspense>
          </div>
        </div>

        {/* News streams last — 30min cache */}
        <Suspense fallback={<NewsSkeleton />}>
          <NewsSection symbol={upper} />
        </Suspense>
      </div>
    </div>
  );
}
