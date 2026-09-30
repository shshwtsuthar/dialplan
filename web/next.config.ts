import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@dialplan/shared'],
  images: { unoptimized: true },
};

export default nextConfig;
