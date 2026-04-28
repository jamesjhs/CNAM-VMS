/** @type {import('next').NextConfig} */
const nextConfig = {
  // Declare the project root for file-tracing so Next.js never walks up to a
  // parent directory and picks up an unrelated lockfile.  Using process.cwd()
  // (the directory from which `next build` is invoked) avoids the dynamic
  // fileURLToPath/path.dirname pattern that triggered Turbopack's unintentional
  // NFT trace warning.
  outputFileTracingRoot: process.cwd(),

  // Produce a self-contained deployment folder — dramatically reduces what
  // needs to be copied to the VPS and eliminates unused node_modules.
  output: 'standalone',

  // Drop source maps from the production build; they nearly double build
  // memory usage and are rarely needed in production.
  productionBrowserSourceMaps: false,

  // Keep the native SQLite addon external so that Node.js resolves it from
  // node_modules at runtime rather than Turbopack trying to bundle the binary.
  serverExternalPackages: ['better-sqlite3-multiple-ciphers'],

  // Tell Next.js to tree-shake this large package at the module level so
  // only the code paths actually used end up in bundles.
  experimental: {
    optimizePackageImports: ['next-auth'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent the site from being embedded in iframes (clickjacking protection)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent browsers from MIME-sniffing the content-type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Enable the browser's built-in XSS protection (legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Control how much referrer information is sent
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict access to browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Note: Strict-Transport-Security (HSTS) is intentionally omitted here.
          // The server runs behind a Cloudflare tunnel which terminates TLS — the
          // app itself listens on plain HTTP and should not set HSTS headers.
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
