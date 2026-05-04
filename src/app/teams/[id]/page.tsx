import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackBool, unpackArr, unpackTs } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addWorkLogEntry, addTeamFeedback } from '../../admin/teams/actions';
import type { TaskType, TaskUrgency } from '@/lib/db-types';

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

function combineWithOther(items: string[], other: string | null): string | null {
  const all = [...items, ...(other ? [other] : [])];
  return all.length > 0 ? all.join(', ') : null;
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { id } = await params;
  const { success, error } = await searchParams;
  const currentUser = await requireAuth();

  const db = getDb();

  const team = db.prepare('SELECT id, name, description FROM teams WHERE id = ?').get(id) as {
    id: string; name: string; description: string | null;
  } | undefined;

  if (!team) notFound();

  const rawMembers = db.prepare(`
    SELECT ut.userId, ut.isLeader, u.id as uid, u.name as uname, u.email as uemail
    FROM user_teams ut
    JOIN users u ON ut.userId = u.id
    WHERE ut.teamId = ?
  `).all(id) as {
    userId: string; isLeader: number; uid: string; uname: string | null; uemail: string;
  }[];

  // Unread team message count for the current user
  const lastReadRow = db.prepare(
    `SELECT lastReadAt FROM message_reads WHERE userId = ? AND context = ?`,
  ).get(currentUser.id, `team:${id}`) as { lastReadAt: string } | undefined;
  const lastReadAt = lastReadRow?.lastReadAt ?? '1970-01-01T00:00:00.000Z';
  const { teamUnreadCount } = db.prepare(`
    SELECT COUNT(*) as teamUnreadCount
    FROM messages
    WHERE teamId = ? AND senderId != ? AND isDeleted = 0 AND createdAt > ?
  `).get(id, currentUser.id, lastReadAt) as { teamUnreadCount: number };

  const members = rawMembers.map((m) => ({
    userId: m.userId,
    isLeader: unpackBool(m.isLeader),
    user: { id: m.uid, name: m.uname, email: m.uemail },
  }));

  const rawTasks = db.prepare(`
    SELECT id, teamId, title, taskType, urgency, description, personnelRequired,
           supervisorRequired, equipment, consumables, safetyIssues,
           equipmentOther, consumablesOther, safetyIssuesOther, equipmentLocations
    FROM team_tasks
    WHERE teamId = ? AND isActive = 1
    ORDER BY CASE urgency WHEN 'URGENT' THEN 0 WHEN 'MODERATE' THEN 1 ELSE 2 END ASC, createdAt DESC
  `).all(id) as {
    id: string; teamId: string; title: string; taskType: string; urgency: string;
    description: string | null; personnelRequired: number | null; supervisorRequired: number;
    equipment: string; consumables: string; safetyIssues: string;
    equipmentOther: string | null; consumablesOther: string | null; safetyIssuesOther: string | null;
    equipmentLocations: string | null;
  }[];

  const taskIds = rawTasks.map((t) => t.id);

  const rawWorkLogs = taskIds.length > 0
    ? db.prepare(`
        SELECT wl.id, wl.taskId, wl.entry, wl.createdAt, u.name as uname, u.email as uemail
        FROM team_work_logs wl
        JOIN users u ON wl.userId = u.id
        WHERE wl.taskId IN (${taskIds.map(() => '?').join(',')})
        ORDER BY wl.createdAt DESC
      `).all(...taskIds) as {
        id: string; taskId: string; entry: string; createdAt: string;
        uname: string | null; uemail: string;
      }[]
    : [];

  const workLogsByTask = new Map<string, typeof rawWorkLogs>();
  for (const wl of rawWorkLogs) {
    if (!workLogsByTask.has(wl.taskId)) workLogsByTask.set(wl.taskId, []);
    workLogsByTask.get(wl.taskId)!.push(wl);
  }

  const tasks = rawTasks.map((t) => ({
    ...t,
    taskType: t.taskType as TaskType,
    urgency: t.urgency as TaskUrgency,
    supervisorRequired: unpackBool(t.supervisorRequired),
    equipment: unpackArr<string>(t.equipment, []),
    consumables: unpackArr<string>(t.consumables, []),
    safetyIssues: unpackArr<string>(t.safetyIssues, []),
    workLogs: (workLogsByTask.get(t.id) ?? []).map((wl) => ({
      ...wl,
      createdAt: unpackTs(wl.createdAt),
      user: { name: wl.uname, email: wl.uemail },
    })),
  }));

  const rawFeedbacks = db.prepare(`
    SELECT tf.id, tf.feedback, tf.createdAt, u.name as uname, u.email as uemail
    FROM team_feedback tf
    JOIN users u ON tf.userId = u.id
    WHERE tf.teamId = ?
    ORDER BY tf.createdAt DESC
  `).all(id) as {
    id: string; feedback: string; createdAt: string; uname: string | null; uemail: string;
  }[];

  const feedbacks = rawFeedbacks.map((f) => ({
    ...f,
    createdAt: unpackTs(f.createdAt),
    user: { name: f.uname, email: f.uemail },
  }));

  const leaders = members.filter((m) => m.isLeader);
  const isLeader = members.some((m) => m.userId === currentUser.id && m.isLeader);
  const isAdmin = hasCapability(currentUser, 'admin:teams.read');
  const canViewLogs = isLeader || isAdmin;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/teams" className="hover:text-gray-700">Teams</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{team.name}</span>
        </nav>

        {/* Success / error banners */}
        {success === 'log' && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✓ Work log entry added. It will be reviewed by your team admin.
          </div>
        )}
        {success === 'feedback' && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✓ Feedback submitted. Thank you.
          </div>
        )}
        {error === 'NotMember' && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            You must be a member of this team to submit entries or feedback.
          </div>
        )}

        {/* Team header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{team.name}</h1>
              {team.description && <p className="text-gray-500 mb-2">{team.description}</p>}
              {leaders.length > 0 && (
                <p className="text-sm text-indigo-600">
                  👤 Team Admin{leaders.length !== 1 ? 's' : ''}:{' '}
                  <span className="font-medium">
                    {leaders.map((m) => m.user.name ?? m.user.email).join(', ')}
                  </span>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            </div>
            {isAdmin && (
              <Link
                href="/admin/teams"
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                ⚙️ Manage
              </Link>
            )}
            <Link
              href={`/teams/${id}/messages`}
              className="relative text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              💬 Messages
              {teamUnreadCount > 0 && (
                <span
                  aria-label={`${teamUnreadCount} unread team message${teamUnreadCount !== 1 ? 's' : ''}`}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold"
                >
                  {teamUnreadCount > 9 ? '9+' : teamUnreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Tasks */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Tasks</h2>
            {isAdmin && (
              <Link
                href="/admin/teams/tasks"
                className="text-sm text-blue-600 hover:underline"
              >
                + Add task
              </Link>
            )}
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No active tasks for this team.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {tasks.map((task) => (
                <div key={task.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Task header */}
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {TASK_TYPE_LABELS[task.taskType]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${URGENCY_COLOURS[task.urgency]}`}>
                        {URGENCY_LABELS[task.urgency]}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                    )}
                  </div>

                  {/* Task details */}
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-b border-gray-100">
                    {task.personnelRequired && (
                      <div>
                        <span className="text-gray-500">Personnel required:</span>{' '}
                        <span className="font-medium">{task.personnelRequired}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Supervisor present:</span>{' '}
                      <span className={`font-medium ${task.supervisorRequired ? 'text-amber-600' : 'text-gray-700'}`}>
                        {task.supervisorRequired ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {combineWithOther(task.equipment, task.equipmentOther) && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">Equipment:</span>{' '}
                        <span className="font-medium">
                          {combineWithOther(task.equipment, task.equipmentOther)}
                        </span>
                      </div>
                    )}
                    {combineWithOther(task.consumables, task.consumablesOther) && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">Consumables:</span>{' '}
                        <span className="font-medium">
                          {combineWithOther(task.consumables, task.consumablesOther)}
                        </span>
                      </div>
                    )}
                    {combineWithOther(task.safetyIssues, task.safetyIssuesOther) && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">Safety issues:</span>{' '}
                        <span className="font-medium text-red-700">
                          ⚠️ {combineWithOther(task.safetyIssues, task.safetyIssuesOther)}
                        </span>
                      </div>
                    )}
                    {task.equipmentLocations && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">Where to find equipment / consumables:</span>
                        <p className="mt-0.5 text-gray-700 bg-gray-50 rounded p-2 text-xs whitespace-pre-wrap">
                          {task.equipmentLocations}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Work log */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Work Log</h4>

                    <form
                      action={async (fd: FormData) => {
                        'use server';
                        const entry = fd.get('entry') as string;
                        await addWorkLogEntry(task.id, entry);
                      }}
                      className="flex gap-2 mb-4"
                    >
                      <input
                        name="entry"
                        type="text"
                        required
                        placeholder="Add a work log entry…"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        Add
                      </button>
                    </form>

                    {canViewLogs ? (
                      task.workLogs.length === 0 ? (
                        <p className="text-xs text-gray-400">No work log entries yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {task.workLogs.map((log) => (
                            <li key={log.id} className="text-sm border-l-2 border-blue-200 pl-3">
                              <span className="text-gray-700">{log.entry}</span>
                              <span className="ml-2 text-xs text-gray-400">
                                — {log.user.name ?? log.user.email},{' '}
                                {log.createdAt.toLocaleString('en-GB')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <p className="text-xs text-gray-400">Work log entries are visible to team admins and administrators.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Feedback section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Feedback</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <form
              action={async (fd: FormData) => {
                'use server';
                const feedback = fd.get('feedback') as string;
                await addTeamFeedback(team.id, feedback);
              }}
              className="flex gap-2 mb-6"
            >
              <input
                name="feedback"
                type="text"
                required
                placeholder="Share feedback about this team…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Submit
              </button>
            </form>

            {canViewLogs ? (
              feedbacks.length === 0 ? (
                <p className="text-sm text-gray-400">No feedback submitted yet.</p>
              ) : (
                <ul className="space-y-3">
                  {feedbacks.map((fb) => (
                    <li key={fb.id} className="text-sm border-l-2 border-indigo-200 pl-3">
                      <span className="text-gray-700">{fb.feedback}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        — {fb.user.name ?? fb.user.email},{' '}
                        {fb.createdAt.toLocaleString('en-GB')}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-sm text-gray-400">Feedback is visible to team admins and administrators once submitted.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
