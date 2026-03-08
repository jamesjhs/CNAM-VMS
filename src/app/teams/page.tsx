import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import type { TaskUrgency } from '@prisma/client';

const URGENCY_COLOURS: Record<TaskUrgency, string> = {
  ROUTINE: 'bg-green-100 text-green-800',
  MODERATE: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};

const URGENCY_LABELS: Record<TaskUrgency, string> = {
  ROUTINE: 'Routine',
  MODERATE: 'Moderate',
  URGENT: 'Urgent',
};

export default async function TeamsPage() {
  await requireAuth();

  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      userTeams: {
        where: { isLeader: true },
        include: { user: { select: { name: true, email: true } } },
      },
      tasks: {
        where: { isActive: true },
        orderBy: [{ urgency: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          taskType: true,
          urgency: true,
          description: true,
          personnelRequired: true,
          supervisorRequired: true,
        },
      },
      _count: { select: { userTeams: true } },
    },
  });

  const urgencyOrder: Record<TaskUrgency, number> = { URGENT: 0, MODERATE: 1, ROUTINE: 2 };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Teams</h1>
          <p className="text-gray-500">Overview of all teams and their active tasks.</p>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No teams have been set up yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {teams.map((team) => {
              const sortedTasks = [...team.tasks].sort(
                (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency],
              );
              return (
                <div key={team.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Team header */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{team.name}</h2>
                      {team.description && (
                        <p className="text-sm text-gray-500">{team.description}</p>
                      )}
                      {team.userTeams.length > 0 && (
                        <p className="text-sm text-indigo-600 mt-0.5">
                          👤 {team.userTeams.map((m) => m.user.name ?? m.user.email).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {team._count.userTeams} member{team._count.userTeams !== 1 ? 's' : ''}
                      </span>
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
                      >
                        Team page →
                      </Link>
                    </div>
                  </div>

                  {/* Tasks summary */}
                  {sortedTasks.length === 0 ? (
                    <div className="px-6 py-4 text-sm text-gray-400">No active tasks for this team.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {sortedTasks.map((task) => (
                        <div key={task.id} className="px-6 py-4 flex items-start gap-3">
                          <span className={`mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${URGENCY_COLOURS[task.urgency]}`}>
                            {URGENCY_LABELS[task.urgency]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">{task.taskType}</span>
                              {task.personnelRequired && (
                                <span className="text-xs text-gray-400">👷 {task.personnelRequired} personnel</span>
                              )}
                              {task.supervisorRequired && (
                                <span className="text-xs text-amber-600">⚠️ Supervisor needed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
