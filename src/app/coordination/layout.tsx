'use client';

import { requireAuth, hasAnyCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';

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
    { href: '/coordination', label: 'Overview', icon: '📊' },
    { href: '/coordination/volunteers', label: 'Volunteers', icon: '👥' },
    { href: '/coordination/availability', label: 'Availability', icon: '📅' },
    { href: '/coordination/projects', label: 'Projects', icon: '📋' },
    { href: '/coordination/messages', label: 'Messages', icon: '💬' },
  ];

  return (
    <CoordinationLayoutClient links={coordinationLinks}>
      {children}
    </CoordinationLayoutClient>
  );
}

function CoordinationLayoutClient({ links, children }: { links: Array<{ href: string; label: string; icon: string }>; children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Close menu when resizing to desktop
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-56 bg-gray-900 text-white flex-col">
          <nav className="p-4 space-y-1 flex-1">
            <div className="mb-6 px-3">
              <h2 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Coordination</h2>
            </div>
            {links.map((link) => (
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
        <main className="flex-1 bg-gray-50 flex flex-col">
          {/* Mobile Navigation Tabs */}
          <div className="md:hidden bg-white border-b border-gray-200">
            <div className="overflow-x-auto">
              <div className="flex gap-1 p-2 min-w-max">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
