'use client';

import { useEffect } from 'react';
import { markTeamRead } from '@/app/messages/actions';

/**
 * Silently marks a team conversation as read when the component mounts.
 * Renders nothing — used purely for the side-effect.
 */
export default function MarkTeamRead({ teamId }: { teamId: string }) {
  useEffect(() => {
    markTeamRead(teamId).catch(() => {
      // Read-tracking is best-effort; ignore errors silently.
    });
  }, [teamId]);

  return null;
}
