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
        ],
      },
    ];
  },
};

export default nextConfig;
