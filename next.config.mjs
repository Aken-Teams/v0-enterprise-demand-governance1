/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['@/components', '@/hooks'],
  },
  // 添加空的 turbopack 配置來避免 webpack 配置衝突
  turbopack: {},
}

export default nextConfig
