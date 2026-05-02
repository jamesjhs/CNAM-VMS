import { requireAuth, hasAnyCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Coordination Dashboard — CNAM VMS',
  description: 'Coordination interface for the CNAM Volunteer Management System',
};

export default async function CoordinationLayout({ children }: { children: ReactNode }) {
  // Require at least one staff capability
  const user = await requireAuth();
  const staffCapabilities = [
    'staff:volunteer.read',
    'staff:projects.read',
    'staff:messaging.write',
    'staff:schedule.read',
  ];
  
  if (!hasAnyCapability(user, staffCapabilities)) {
    redirect('/unauthorized');
  }

  const coordinationLinks = [
    { href: '/coordination', label: 'Overview' },
    { href: '/coordination/volunteers', label: 'Volunteers' },
    { href: '/coordination/availability', label: 'Availability' },
    { href: '/coordination/projects', label: 'Projects' },
    { href: '/coordination/messages', label: 'Messages' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 text-white">
          <nav className="p-4 space-y-1">
            <div className="mb-6 px-3">
              <h2 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Coordination</h2>
            </div>
            {coordinationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
