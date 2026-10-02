import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// The monorepo keeps one .env at the repository root; Next.js only reads apps/web/.env*.
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const securityHeaders = [
  // Browsers ignore HSTS over plain HTTP, so it is harmless for local runs.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Internal packages ship TypeScript sources (docs/DECISIONS.md D-004).
  transpilePackages: [
    '@gamepulse/collectors',
    '@gamepulse/config',
    '@gamepulse/database',
    '@gamepulse/domain',
    '@gamepulse/ingestion',
    '@gamepulse/observability',
    '@gamepulse/parsers',
    '@gamepulse/ui',
    '@gamepulse/validators',
  ],
  serverExternalPackages: ['postgres'],
  // Fixture mode (development/previews) reads ../../fixtures at runtime.
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  outputFileTracingIncludes: { '/**': ['../../fixtures/**/*.json'] },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
