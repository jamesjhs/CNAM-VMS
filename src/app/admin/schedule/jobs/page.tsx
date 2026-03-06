import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { createJob, updateJob, deleteJob } from '../actions';
import { WEEK_DAY_LABELS } from '@/lib/calendar';
import JobForm from './JobForm';

function parseArrayField(formData: FormData, name: string): number[] {
  try {
    const raw = formData.get(name) as string;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export default async function JobsAdminPage() {
  await requireCapability('admin:calendar.write');

  const jobs = await prisma.job.findMany({
    orderBy: [{ scheduleType: 'asc' }, { isRolling: 'desc' }, { title: 'asc' }],
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
              Define rolling duties and rostered roles. Set a recurrence schedule so jobs appear
              automatically on the calendar for volunteers to sign up to.
            </p>
          </div>
          <span className="text-sm text-gray-500">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Create new job form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">Add New Job</h2>
          <JobForm
            mode="create"
            action={async (formData: FormData) => {
              'use server';
              const title = formData.get('title') as string;
              const description = formData.get('description') as string;
              const isRolling = formData.get('isRolling') === 'rolling';
              const colour = formData.get('colour') as string;
              const scheduleType = formData.get('scheduleType') as string;
              const weekDays = parseArrayField(formData, 'weekDaysJson');
              const monthDays = parseArrayField(formData, 'monthDaysJson');
              const defaultStartTime = formData.get('defaultStartTime') as string ?? '';
              const defaultEndTime = formData.get('defaultEndTime') as string ?? '';
              const defaultMaxSignups = formData.get('defaultMaxSignups') as string ?? '';
              await createJob(title, description, isRolling, colour, scheduleType, weekDays, monthDays, defaultStartTime, defaultEndTime, defaultMaxSignups);
            }}
          />
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
            <div className="space-y-4">
              {rollingJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>

        {/* Rostered jobs */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 inline-block"></span>
            Rostered Jobs
            <span className="text-xs text-gray-400 font-normal">(placed on calendar by administrators)</span>
          </h2>
          {rosteredJobs.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No rostered jobs defined yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rosteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function recurrenceSummary(job: {
  scheduleType: string;
  weekDays: number[];
  monthDays: number[];
}): string {
  if (job.scheduleType === 'WEEKLY') {
    if (job.weekDays.length === 0) return 'Weekly (no days set)';
    return 'Every ' + job.weekDays.map((d) => WEEK_DAY_LABELS[d]).join(', ');
  }
  if (job.scheduleType === 'MONTHLY') {
    if (job.monthDays.length === 0) return 'Monthly (no days set)';
    const suffix = (n: number) => {
      if (n >= 11 && n <= 13) return `${n}th`;
      if (n % 10 === 1) return `${n}st`;
      if (n % 10 === 2) return `${n}nd`;
      if (n % 10 === 3) return `${n}rd`;
      return `${n}th`;
    };
    return job.monthDays.map(suffix).join(', ') + ' of each month';
  }
  return 'One-off (manual placement)';
}

function JobCard({
  job,
}: {
  job: {
    id: string;
    title: string;
    description: string | null;
    isRolling: boolean;
    colour: string;
    scheduleType: string;
    weekDays: number[];
    monthDays: number[];
    defaultStartTime: string | null;
    defaultEndTime: string | null;
    defaultMaxSignups: number | null;
    _count: { calendarEvents: number };
  };
}) {
  const summary = recurrenceSummary(job);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Job info bar */}
      <div className="flex items-start gap-3 p-4 border-b border-gray-100">
        <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: job.colour }} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900">{job.title}</div>
          {job.description && <div className="text-xs text-gray-500 mt-0.5">{job.description}</div>}
          <div className="flex flex-wrap gap-2 mt-1.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${job.isRolling ? 'bg-green-100 text-green-800' : 'bg-violet-100 text-violet-800'}`}>
              {job.isRolling ? 'Rolling' : 'Rostered'}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${job.scheduleType === 'ONE_OFF' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
              {job.scheduleType === 'ONE_OFF' ? '📋 One-off' : job.scheduleType === 'WEEKLY' ? '🔁 Weekly' : '📅 Monthly'}
            </span>
            <span className="text-xs text-gray-400">{summary}</span>
          </div>
          {(job.defaultStartTime || job.defaultEndTime) && (
            <div className="text-xs text-gray-400 mt-0.5">
              Default time: {job.defaultStartTime ?? ''}
              {job.defaultEndTime ? `–${job.defaultEndTime}` : ''}
              {job.defaultMaxSignups ? ` · Max ${job.defaultMaxSignups} volunteers` : ''}
            </div>
          )}
          <div className="text-xs text-gray-400 mt-0.5">{job._count.calendarEvents} calendar event{job._count.calendarEvents !== 1 ? 's' : ''}</div>
        </div>
        <form action={deleteJob.bind(null, job.id)}>
          <button
            type="submit"
            className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
          >
            Delete
          </button>
        </form>
      </div>

      {/* Edit form */}
      <details className="group">
        <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700 hover:bg-gray-50 select-none list-none flex items-center gap-1">
          <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Edit this job
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <JobForm
            mode="edit"
            job={job}
            action={async (formData: FormData) => {
              'use server';
              const jobId = formData.get('jobId') as string;
              const title = formData.get('title') as string;
              const description = formData.get('description') as string;
              const isRolling = formData.get('isRolling') === 'rolling';
              const colour = formData.get('colour') as string;
              const scheduleType = formData.get('scheduleType') as string;
              const weekDays: number[] = (() => {
                try { return JSON.parse(formData.get('weekDaysJson') as string); } catch { return []; }
              })();
              const monthDays: number[] = (() => {
                try { return JSON.parse(formData.get('monthDaysJson') as string); } catch { return []; }
              })();
              const defaultStartTime = formData.get('defaultStartTime') as string ?? '';
              const defaultEndTime = formData.get('defaultEndTime') as string ?? '';
              const defaultMaxSignups = formData.get('defaultMaxSignups') as string ?? '';
              await updateJob(jobId, title, description, isRolling, colour, scheduleType, weekDays, monthDays, defaultStartTime, defaultEndTime, defaultMaxSignups);
            }}
          />
        </div>
      </details>
    </div>
  );
}
