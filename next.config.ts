import type { NextConfig } from "next";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true' || process.env.ANALYZE === '1',
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
};

export default withBundleAnalyzer(nextConfig);
