import type { Metadata, Viewport } from 'next';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CNAM Volunteer Management System',
  description: 'City of Norwich Aviation Museum — Volunteer Management System. Coordinate schedules, manage tasks, and keep the museum running smoothly.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'CNAM Volunteer Management System',
    description: 'City of Norwich Aviation Museum — Volunteer Management System',
    siteName: 'CNAM VMS',
    url: 'https://cnamvps.jahosi.co.uk',
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
          <Link href="/privacy" className="hover:text-white transition-colors underline">
            Privacy &amp; Cookie Policy
          </Link>
          {' · '}
          <span>© {new Date().getFullYear()} City of Norwich Aviation Museum</span>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
