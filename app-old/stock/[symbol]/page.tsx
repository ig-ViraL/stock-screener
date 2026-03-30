import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchStockDetail, fetchBasicFinancials } from "@/lib/finnhub";
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

  return {
    title: `${upper} | Stock Screener`,
    description: `Real-time stock data, key metrics, and analyst recommendations for ${upper}`,
  };
}

async function HeaderSection({ symbol }: { symbol: string }) {
  const [stock, metrics] = await Promise.all([
    fetchStockDetail(symbol),
    fetchBasicFinancials(symbol).catch(() => null),
  ]);

  if (!stock) notFound();

  return <StockDetailHeader stock={stock} metrics={metrics} />;
}

export default async function StockDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="space-y-8">
          <HeaderSection symbol={upper} />

          <div className="grid gap-8 lg:grid-cols-2">
            <Suspense fallback={<MetricsSkeleton />}>
              <KeyMetrics symbol={upper} />
            </Suspense>

            <div className="space-y-8">
              <Suspense fallback={<ProfileSkeleton />}>
                <CompanyProfile symbol={upper} />
              </Suspense>

              <Suspense fallback={<RecommendationSkeleton />}>
                <AnalystRecommendations symbol={upper} />
              </Suspense>
            </div>
          </div>

          <Suspense fallback={<NewsSkeleton />}>
            <NewsSection symbol={upper} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
