'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface NavLink {
  href: string;
  label: string;
}

interface MobileMenuProps {
  links: NavLink[];
  adminLinks: NavLink[];
  showAdminMenu: boolean;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

export default function MobileMenu({
  links,
  adminLinks,
  showAdminMenu,
  userName,
  userEmail,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        {open ? (
          /* X icon */
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          /* Hamburger icon */
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="absolute top-16 left-0 right-0 bg-[#1a3a5c] border-t border-white/10 shadow-xl z-50">
          <div className="px-4 py-3 space-y-1">
            {/* Standard nav links */}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {/* Admin / staff section */}
            {showAdminMenu && adminLinks.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setAdminOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  <span>Admin</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {adminOpen && (
                  <div className="ml-3 mt-1 space-y-1 border-l-2 border-white/20 pl-3">
                    {adminLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-white/10 pt-3 mt-3">
              {userName || userEmail ? (
                <div className="px-3 py-1 text-xs text-gray-400 truncate mb-2">
                  {userName ?? userEmail}
                </div>
              ) : null}
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
              >
                My Profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
