import { requireAuth, hasAnyCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Staff Dashboard — CNAM VMS',
  description: 'Staff management interface for the CNAM Volunteer Management System',
};

export default async function StaffLayout({ children }: { children: ReactNode }) {
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

  const staffLinks = [
    { href: '/staff', label: 'Overview' },
    { href: '/staff/volunteers', label: 'Volunteers' },
    { href: '/staff/availability', label: 'Availability' },
    { href: '/staff/projects', label: 'Projects' },
    { href: '/staff/messages', label: 'Messages' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 text-white">
          <nav className="p-4 space-y-1">
            <div className="mb-6 px-3">
              <h2 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Staff Management</h2>
            </div>
            {staffLinks.map((link) => (
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
