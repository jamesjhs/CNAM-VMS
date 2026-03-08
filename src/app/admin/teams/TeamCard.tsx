'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface TeamMember {
  userId: string;
  isLeader: boolean;
  user: { id: string; name: string | null; email: string };
}

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    _count: { userTeams: number; tasks: number };
    userTeams: TeamMember[];
  };
  updateTeamAction: (teamId: string, name: string, description: string) => Promise<void>;
  deleteTeamAction: (teamId: string) => Promise<void>;
  toggleLeaderAction: (teamId: string, userId: string) => Promise<void>;
}

export default function TeamCard({
  team,
  updateTeamAction,
  deleteTeamAction,
  toggleLeaderAction,
}: TeamCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState(team.name);
  const [descVal, setDescVal] = useState(team.description ?? '');
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  const leaders = team.userTeams.filter((m) => m.isLeader);

  async function saveName() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== team.name) {
      await updateTeamAction(team.id, trimmed, descVal.trim());
    }
    setEditingName(false);
  }

  async function saveDesc() {
    const trimmedName = nameVal.trim() || team.name;
    const trimmedDesc = descVal.trim();
    if (trimmedDesc !== (team.description ?? '')) {
      await updateTeamAction(team.id, trimmedName, trimmedDesc);
    }
    setEditingDesc(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        {/* Inline-editable name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {editingName ? (
              <input
                ref={nameRef}
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveName(); }
                  if (e.key === 'Escape') { setNameVal(team.name); setEditingName(false); }
                }}
                autoFocus
                className="font-semibold text-gray-900 text-base border-b-2 border-blue-500 bg-transparent outline-none min-w-0 flex-1"
              />
            ) : (
              <button
                type="button"
                title="Click to edit name"
                onClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.focus(), 10); }}
                className="font-semibold text-gray-900 hover:text-blue-600 hover:underline decoration-dashed underline-offset-2 text-left"
              >
                {nameVal || team.name}
              </button>
            )}
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
              {team._count.userTeams} member{team._count.userTeams !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
              {team._count.tasks} task{team._count.tasks !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Description inline edit */}
          {editingDesc ? (
            <input
              ref={descRef}
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveDesc(); }
                if (e.key === 'Escape') { setDescVal(team.description ?? ''); setEditingDesc(false); }
              }}
              autoFocus
              placeholder="Add a description…"
              className="text-gray-500 text-sm border-b border-blue-400 bg-transparent outline-none w-full"
            />
          ) : (
            <button
              type="button"
              title="Click to edit description"
              onClick={() => { setEditingDesc(true); setTimeout(() => descRef.current?.focus(), 10); }}
              className={`text-sm text-left hover:underline decoration-dashed underline-offset-2 ${
                descVal || team.description ? 'text-gray-500 hover:text-blue-600' : 'text-gray-300 hover:text-blue-400 italic'
              }`}
            >
              {descVal || team.description || 'Add a description…'}
            </button>
          )}

          {/* Leaders summary */}
          {leaders.length > 0 && (
            <p className="text-sm text-indigo-600 mt-1">
              👤 Admin{leaders.length !== 1 ? 's' : ''}:{' '}
              {leaders.map((m) => m.user.name ?? m.user.email).join(', ')}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-1">
            Created {team.createdAt.toLocaleDateString('en-GB')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/teams/${team.id}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            View page
          </Link>
          <form action={deleteTeamAction.bind(null, team.id)}>
            <button
              type="submit"
              className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Team admin / leader assignment */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Team Admins</p>
        {team.userTeams.length === 0 ? (
          <p className="text-xs text-gray-400">No members yet. Add members via User Management.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {team.userTeams.map(({ userId, isLeader, user }) => (
              <form
                key={userId}
                action={toggleLeaderAction.bind(null, team.id, userId)}
              >
                <button
                  type="submit"
                  title={isLeader ? 'Remove admin role' : 'Grant admin role'}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    isLeader
                      ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
                  }`}
                >
                  {isLeader && <span>★</span>}
                  {user.name ?? user.email}
                </button>
              </form>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">Click a member to toggle their admin status.</p>
      </div>
    </div>
  );
}
