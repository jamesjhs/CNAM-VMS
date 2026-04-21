/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained deployment folder — dramatically reduces what
  // needs to be copied to the VPS and eliminates unused node_modules.
  output: 'standalone',

  // Drop source maps from the production build; they nearly double build
  // memory usage and are rarely needed in production.
  productionBrowserSourceMaps: false,

  // Tell Next.js to tree-shake these large packages at the module level so
  // only the code paths actually used end up in bundles.
  experimental: {
    optimizePackageImports: ['next-auth', '@auth/prisma-adapter'],
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
          // Enforce HTTPS for 2 years (include subdomains)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires inline scripts and eval for its runtime
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Allow inline styles (Tailwind CSS uses them)
              "style-src 'self' 'unsafe-inline'",
              // Images: allow self and data URIs
              "img-src 'self' data: blob:",
              // Fonts: allow self
              "font-src 'self'",
              // Restrict fetch/XHR/WebSocket to same origin
              "connect-src 'self'",
              // Disallow all object/embed/applet elements
              "object-src 'none'",
              // Base URI restricted to same origin
              "base-uri 'self'",
              // Disallow form actions to other origins
              "form-action 'self'",
              // Prevent framing by other origins
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
