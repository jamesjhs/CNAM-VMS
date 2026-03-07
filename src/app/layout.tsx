import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CNAM Volunteer Management System',
  description: 'City of Norwich Aviation Museum — Volunteer Management System. Coordinate schedules, manage tasks, and keep the museum running smoothly.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'CNAM Volunteer Management System',
    description: 'City of Norwich Aviation Museum — Volunteer Management System',
    siteName: 'CNAM VMS',
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
      </body>
    </html>
  );
}
