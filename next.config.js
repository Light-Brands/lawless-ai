/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for streaming
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
