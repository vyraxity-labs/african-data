import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/styles', '@repo/types', '@repo/validation'],
}

export default nextConfig
