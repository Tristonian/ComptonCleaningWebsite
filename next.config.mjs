import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Gives `next dev` the wrangler.jsonc bindings (R2) locally, backed by a local
// miniflare store under .wrangler/state. No effect in production builds.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Dev only: allows framing at phone width for testing. Production always sends DENY.
          ...(process.env.NODE_ENV === 'development' ? [] : [{ key: 'X-Frame-Options', value: 'DENY' }]),
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
