import { requireCapability } from '@/lib/auth-helpers';
import { getDb, unpackDate } from '@/lib/db';
import Link from 'next/link';

export default async function CoordinationProjectsPage() {
  await requireCapability('staff:projects.read');

  const db = getDb();

  // Get teams and their active tasks
  const rawTeams = db.prepare(`
    SELECT t.id, t.name, t.description, t.createdAt,
           COUNT(DISTINCT ut.userId) as memberCount,
           COUNT(DISTINCT tt.id) as taskCount
    FROM teams t
    LEFT JOIN user_teams ut ON t.id = ut.teamId
    LEFT JOIN team_tasks tt ON t.id = tt.teamId
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all() as {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
    taskCount: number;
  }[];

  const teams = rawTeams.map((t) => ({
    ...t,
    createdAt: unpackDate(t.createdAt),
  }));

  // Get detailed task info
  const tasksByTeam: { [teamId: string]: any[] } = {};

  for (const team of teams) {
    const rawTasks = db.prepare(`
      SELECT tt.id, tt.title, tt.description, tt.urgency, tt.status, tt.createdAt,
             COUNT(DISTINCT twl.id) as logCount
      FROM team_tasks tt
      LEFT JOIN team_work_logs twl ON tt.id = twl.taskId
      WHERE tt.teamId = ?
      GROUP BY tt.id
      ORDER BY tt.urgency DESC, tt.createdAt ASC
    `).all(team.id) as {
      id: string;
      title: string;
      description: string | null;
      urgency: string;
      status: string;
      createdAt: string;
      logCount: number;
    }[];

    tasksByTeam[team.id] = rawTasks.map((t) => ({
      ...t,
      createdAt: unpackDate(t.createdAt),
    }));
  }

  const urgencyBadges = {
    LOW: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Low' },
    MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Medium' },
    HIGH: { bg: 'bg-red-100', text: 'text-red-800', label: 'High' },
  };

  const statusBadges = {
    PENDING: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Pending' },
    IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects & Teams</h1>
        <p className="text-gray-600">{teams.length} active teams and their projects</p>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No teams found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map((team) => {
            const tasks = tasksByTeam[team.id] || [];

            return (
              <div key={team.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
                      {team.description && <p className="text-sm text-gray-600 mt-1">{team.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{team.memberCount}</div>
                        <div className="text-xs text-gray-600">Members</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{tasks.length}</div>
                        <div className="text-xs text-gray-600">Tasks</div>
                      </div>
                    </div>
                  </div>
                </div>

                {tasks.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-gray-500 text-sm">No tasks assigned to this team</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {tasks.map((task) => {
                      const urgencyInfo = urgencyBadges[task.urgency as keyof typeof urgencyBadges] || urgencyBadges.LOW;
                      const statusInfo = statusBadges[task.status as keyof typeof statusBadges] || statusBadges.PENDING;

                      return (
                        <div key={task.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-gray-900 truncate">{task.title}</h4>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${urgencyInfo.bg} ${urgencyInfo.text}`}>
                                  {urgencyInfo.label}
                                </span>
                              </div>
                              {task.description && <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>}
                            </div>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                                {statusInfo.label}
                              </span>
                              {task.logCount > 0 && (
                                <span className="text-xs text-gray-500">
                                  {task.logCount} log{task.logCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Projects Overview</h3>
        <p className="text-sm text-blue-800 mb-3">
          This page shows all active teams and their assigned projects (tasks). You can see:
        </p>
        <ul className="text-sm text-blue-800 space-y-1 ml-4">
          <li>• Team name, description, and member count</li>
          <li>• Active tasks with urgency levels and status</li>
          <li>• Task descriptions and work log counts</li>
          <li>• Task priorities to help coordinate resources</li>
        </ul>
      </div>
    </div>
  );
}
