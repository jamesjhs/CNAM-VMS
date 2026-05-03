import { requireAuth, hasAnyCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
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
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
