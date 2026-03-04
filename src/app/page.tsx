import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { auth } from '@/auth';

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        {/* Hero section */}
        <section className="bg-[#1a3a5c] text-white py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6">
              <span className="inline-block bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide mb-4">
                Volunteer Management
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
              City of Norwich Aviation Museum
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Volunteer Management System — coordinate schedules, manage tasks, and keep the museum running smoothly.
            </p>
            {session ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/dashboard"
                  className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/admin"
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                >
                  Admin Panel
                </Link>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
              >
                Sign in with Email
              </Link>
            )}
          </div>
        </section>

        {/* Features section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
              Everything you need to manage volunteers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: '📋',
                  title: 'Task Management',
                  description: 'Assign and track volunteer tasks with ease.',
                },
                {
                  icon: '📅',
                  title: 'Scheduling',
                  description: 'Manage availability and shift calendars.',
                },
                {
                  icon: '👥',
                  title: 'Team Coordination',
                  description: 'Organise volunteers into teams and roles.',
                },
                {
                  icon: '🔒',
                  title: 'Secure Access',
                  description: 'Passwordless login with capability-based permissions.',
                },
                {
                  icon: '📁',
                  title: 'Document Storage',
                  description: 'Upload and manage policies and resources.',
                },
                {
                  icon: '📊',
                  title: 'Audit Logs',
                  description: 'Full audit trail of all system actions.',
                },
              ].map((feature) => (
                <div key={feature.title} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#1a3a5c] text-gray-400 text-sm py-6 px-4 text-center">
        <p>© {new Date().getFullYear()} City of Norwich Aviation Museum. All rights reserved.</p>
      </footer>
    </div>
  );
}
