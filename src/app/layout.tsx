import type { Metadata, Viewport } from 'next';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import VersionNotice from '@/components/VersionNotice';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';

export const metadata: Metadata = {
  title: 'CNAM Volunteer Management System',
  description: 'City of Norwich Aviation Museum — Volunteer Management System. Coordinate schedules, manage tasks, and keep the museum running smoothly.',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'CNAM VMS',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: 'CNAM Volunteer Management System',
    description: 'City of Norwich Aviation Museum — Volunteer Management System',
    siteName: 'CNAM VMS',
    url: process.env.AUTH_URL ?? undefined,
    locale: 'en_GB',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1a3a5c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
        <footer className="bg-[#1a3a5c] text-gray-300 text-xs text-center py-3 px-4">
          <div className="space-x-2">
            <Link href="/help" className="hover:text-white transition-colors underline">
              Help
            </Link>
            {' · '}
            <Link href="/privacy" className="hover:text-white transition-colors underline">
              Privacy &amp; Cookie Policy
            </Link>
            {' · '}
            <span>© {new Date().getFullYear()} City of Norwich Aviation Museum</span>
            {' · '}
            <span className="opacity-60">v{APP_VERSION}</span>
          </div>
        </footer>
        <CookieBanner />
        <VersionNotice />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
