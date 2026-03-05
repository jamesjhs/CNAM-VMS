import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CNAM Volunteer Management System',
  description: 'City of Norwich Aviation Museum - Volunteer Management System',
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
