'use client';

import Link from 'next/link';

interface CoordinationLink {
  href: string;
  label: string;
  icon: string;
}

export default function CoordinationNav({ links }: { links: CoordinationLink[] }) {
  return (
    <div className="md:hidden bg-white border-b border-gray-200">
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-max">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
