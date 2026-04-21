/** @type {import('next').NextConfig} */
const nextConfig = {
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
