import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { deleteTeamTask } from '../actions';
import type { TaskType, TaskUrgency } from '@prisma/client';
import TaskFormClient from './TaskFormClient';

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  SITE: 'Site',
  DISPLAY: 'Display',
  AIRFRAME: 'Airframe',
};

const URGENCY_LABELS: Record<TaskUrgency, string> = {
  ROUTINE: 'Routine',
  MODERATE: 'Moderate (deterioration)',
  URGENT: 'Urgent (safety)',
};

const URGENCY_COLOURS: Record<TaskUrgency, string> = {
  ROUTINE: 'bg-green-100 text-green-800',
  MODERATE: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireCapability('admin:tasks.write');

  const { success, error } = await searchParams;

  const [teams, tasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.teamTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { name: true } } },
    }),
  ]);

  const successMessages: Record<string, string> = {
    created: '\u2713 Task created successfully.',
    updated: '\u2713 Task updated successfully.',
    deleted: '\u2713 Task deleted.',
  };
  const errorMessages: Record<string, string> = {
    MissingFields: 'Please fill in all required fields (team and title).',
    TeamNotFound: 'The selected team no longer exists.',
    NotFound: 'Task not found \u2014 it may have already been deleted.',
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <Link href="/admin/teams" className="hover:text-gray-700">Teams</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Task Forms</span>
        </nav>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Task Forms</h1>
            <p className="text-gray-500">Create and manage structured task forms for teams.</p>
          </div>
          <span className="text-sm text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Success / error banners */}
        {success && successMessages[success] && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMessages[success]}
          </div>
        )}
        {error && errorMessages[error] && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessages[error]}
          </div>
        )}

        {/* Create task form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-6">Create New Task</h2>
          <TaskFormClient teams={teams} />
        </div>

        {/* Tasks list */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No tasks defined yet. Create your first task above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <details key={task.id} className="bg-white rounded-xl border border-gray-200 group">
                <summary className="p-6 cursor-pointer flex items-start justify-between gap-4 list-none">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {TASK_TYPE_LABELS[task.taskType]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${URGENCY_COLOURS[task.urgency]}`}>
                        {URGENCY_LABELS[task.urgency]}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {task.team.name}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-gray-500 text-sm truncate">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form
                      action={async () => {
                        'use server';
                        await deleteTeamTask(task.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </form>
                    <span className="text-gray-400 text-sm">▼</span>
                  </div>
                </summary>
                <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-400 mb-4">
                    Expand to edit \u2014 changes are saved immediately on submit.
                  </p>
                  <TaskFormClient
                    teams={teams}
                    task={task}
                  />
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
