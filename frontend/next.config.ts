import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  },
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    // Local dev only: proxy /api/* to Express on port 5000
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ]
    }
    return []
  },
}

export default nextConfig
