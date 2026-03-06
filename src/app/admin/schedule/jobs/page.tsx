import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { createJob, updateJob, deleteJob } from '../actions';
import { JOB_COLOURS } from '@/lib/calendar';
import type { CalendarEventType } from '@prisma/client';

export default async function JobsAdminPage() {
  await requireCapability('admin:calendar.write');

  const jobs = await prisma.job.findMany({
    orderBy: [{ isRolling: 'desc' }, { title: 'asc' }],
    include: { _count: { select: { calendarEvents: true } } },
  });

  const rollingJobs = jobs.filter((j) => j.isRolling);
  const rosteredJobs = jobs.filter((j) => !j.isRolling);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <Link href="/admin/schedule" className="hover:text-gray-700">Schedule</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Jobs</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Job Management</h1>
            <p className="text-gray-500">
              Define rolling duties (always available) and rostered options (assigned via calendar events).
            </p>
          </div>
          <span className="text-sm text-gray-500">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Create new job form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">Add New Job</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const title = formData.get('title') as string;
              const description = formData.get('description') as string;
              const isRolling = formData.get('isRolling') === 'rolling';
              const colour = formData.get('colour') as string;
              await createJob(title, description, isRolling, colour);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Job title *</label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Grass Cutting"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  name="description"
                  type="text"
                  placeholder="Brief description"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  name="isRolling"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="rolling">Rolling — always available</option>
                  <option value="rostered">Rostered — added to calendar by admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Colour</label>
                <select
                  name="colour"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {JOB_COLOURS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Add Job
              </button>
            </div>
          </form>
        </div>

        {/* Rolling jobs */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
            Rolling Jobs
            <span className="text-xs text-gray-400 font-normal">(always available for volunteers to sign up for)</span>
          </h2>
          {rollingJobs.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No rolling jobs defined yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rollingJobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>

        {/* Rostered jobs */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 inline-block"></span>
            Rostered Jobs
            <span className="text-xs text-gray-400 font-normal">(added to specific calendar events by administrators)</span>
          </h2>
          {rosteredJobs.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No rostered jobs defined yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rosteredJobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function JobRow({
  job,
}: {
  job: {
    id: string;
    title: string;
    description: string | null;
    isRolling: boolean;
    colour: string;
    _count: { calendarEvents: number };
  };
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: job.colour }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900">{job.title}</div>
            {job.description && <div className="text-xs text-gray-500 mt-0.5">{job.description}</div>}
            <div className="text-xs text-gray-400 mt-0.5">
              {job.isRolling ? 'Rolling' : 'Rostered'} · {job._count.calendarEvents} event{job._count.calendarEvents !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <form
            action={async (formData: FormData) => {
              'use server';
              const title = formData.get('title') as string;
              const description = formData.get('description') as string;
              const isRolling = formData.get('isRolling') === 'rolling';
              const colour = formData.get('colour') as string;
              await updateJob(job.id, title, description, isRolling, colour);
            }}
            className="flex items-center gap-2"
          >
            <input
              name="title"
              type="text"
              required
              defaultValue={job.title}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              name="isRolling"
              defaultValue={job.isRolling ? 'rolling' : 'rostered'}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="rolling">Rolling</option>
              <option value="rostered">Rostered</option>
            </select>
            <select
              name="colour"
              defaultValue={job.colour}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {JOB_COLOURS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input type="hidden" name="description" value={job.description ?? ''} />
            <button
              type="submit"
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              Save
            </button>
          </form>
          <form action={deleteJob.bind(null, job.id)}>
            <button
              type="submit"
              className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
