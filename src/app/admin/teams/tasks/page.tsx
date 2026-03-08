import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { createTeamTask, updateTeamTask, deleteTeamTask } from '../actions';
import type { TaskType, TaskUrgency } from '@prisma/client';

const EQUIPMENT_OPTIONS = [
  'PPE',
  'Aircraft stands',
  'Safety signs',
  'Safety raiser',
  'Ladders',
  'Tie-downs',
  'Cherry picker',
  'Tow vehicle',
];

const CONSUMABLE_OPTIONS = ['Paint', 'Brushes', 'Oils/greases', 'Tape'];

const SAFETY_OPTIONS = [
  'Working at height',
  'Public presence',
  'Mains electricity',
  'Heavy items',
  'Confined spaces',
  'COSHH (Chemicals)',
];

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

export default async function AdminTasksPage() {
  await requireCapability('admin:tasks.write');

  const [teams, tasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.teamTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { name: true } } },
    }),
  ]);

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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Task Forms</h1>
            <p className="text-gray-500">Create and manage structured task forms for teams.</p>
          </div>
          <span className="text-sm text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Create task form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-6">Create New Task</h2>
          <TaskForm teams={teams} />
        </div>

        {/* Tasks list */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No tasks defined yet. Create your first task above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <details key={task.id} className="bg-white rounded-xl border border-gray-200">
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
                  <TaskForm
                    teams={teams}
                    task={task}
                    action={async (fd: FormData) => {
                      'use server';
                      await updateTeamTask(task.id, fd);
                    }}
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

// ---------------------------------------------------------------------------
// Shared task form component
// ---------------------------------------------------------------------------

function TaskForm({
  teams,
  task,
  action,
}: {
  teams: { id: string; name: string }[];
  task?: {
    id: string;
    teamId: string;
    title: string;
    taskType: TaskType;
    urgency: TaskUrgency;
    description: string | null;
    personnelRequired: number | null;
    supervisorRequired: boolean;
    equipment: string[];
    equipmentOther: string | null;
    consumables: string[];
    consumablesOther: string | null;
    safetyIssues: string[];
    safetyIssuesOther: string | null;
    equipmentLocations: string | null;
  };
  action?: (fd: FormData) => Promise<void>;
}) {
  const isEdit = !!task;
  const formAction = isEdit ? action! : createTeamTask;

  return (
    <form action={formAction} className="space-y-6">
      {/* Team selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Team *</label>
          <select
            name="teamId"
            required
            defaultValue={task?.teamId ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Task title *</label>
          <input
            name="title"
            type="text"
            required
            defaultValue={task?.title ?? ''}
            placeholder="e.g. Aircraft exterior wash"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Type and urgency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            name="taskType"
            required
            defaultValue={task?.taskType ?? 'SITE'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SITE">Site</option>
            <option value="DISPLAY">Display</option>
            <option value="AIRFRAME">Airframe</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Urgency *</label>
          <select
            name="urgency"
            required
            defaultValue={task?.urgency ?? 'ROUTINE'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ROUTINE">Routine</option>
            <option value="MODERATE">Moderate (deterioration)</option>
            <option value="URGENT">Urgent (safety)</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Task description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={task?.description ?? ''}
          placeholder="Free-text description of the task…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Personnel and supervisor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expected number of personnel required</label>
          <input
            name="personnelRequired"
            type="number"
            min={1}
            defaultValue={task?.personnelRequired ?? ''}
            placeholder="e.g. 4"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <input
            id={`supervisor-${task?.id ?? 'new'}`}
            name="supervisorRequired"
            type="checkbox"
            value="1"
            defaultChecked={task?.supervisorRequired ?? false}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={`supervisor-${task?.id ?? 'new'}`} className="text-sm text-gray-700">
            Does supervisor need to be present?
          </label>
        </div>
      </div>

      {/* Equipment required */}
      <MultiSelect
        label="Equipment required"
        name="equipment"
        options={EQUIPMENT_OPTIONS}
        selected={task?.equipment ?? []}
        otherName="equipmentOther"
        otherValue={task?.equipmentOther ?? ''}
        suffix={task?.id ?? 'new'}
      />

      {/* Consumables */}
      <MultiSelect
        label="Consumables"
        name="consumables"
        options={CONSUMABLE_OPTIONS}
        selected={task?.consumables ?? []}
        otherName="consumablesOther"
        otherValue={task?.consumablesOther ?? ''}
        suffix={task?.id ?? 'new'}
      />

      {/* Safety issues */}
      <MultiSelect
        label="Safety issues"
        name="safetyIssues"
        options={SAFETY_OPTIONS}
        selected={task?.safetyIssues ?? []}
        otherName="safetyIssuesOther"
        otherValue={task?.safetyIssuesOther ?? ''}
        suffix={task?.id ?? 'new'}
      />

      {/* Equipment locations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Where to find the selected equipment / consumables
        </label>
        <p className="text-xs text-gray-400 mb-1">
          Auto-populated from equipment and consumables selections; edit as needed.
        </p>
        <textarea
          name="equipmentLocations"
          rows={3}
          defaultValue={task?.equipmentLocations ?? ''}
          placeholder="e.g. PPE — red cabinet in hangar A; Paint — store room shelf 3…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {isEdit ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  );
}

function MultiSelect({
  label,
  name,
  options,
  selected,
  otherName,
  otherValue,
  suffix,
}: {
  label: string;
  name: string;
  options: string[];
  selected: string[];
  otherName: string;
  otherValue: string;
  suffix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={opt}
              defaultChecked={selected.includes(opt)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {opt}
          </label>
        ))}
      </div>
      <div className="mt-2">
        <input
          type="text"
          name={otherName}
          defaultValue={otherValue}
          placeholder={`Add other (${label.toLowerCase()})…`}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
        />
      </div>
    </div>
  );
}
