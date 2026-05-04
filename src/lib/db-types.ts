/**
 * Local type definitions that replace the @prisma/client enum imports.
 * All of these correspond 1-to-1 with the TEXT CHECK constraints in the SQLite schema.
 */

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export const USER_STATUSES: UserStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED'];

export type CalendarEventType = 'EVENT' | 'ROSTER' | 'HELP_NEEDED';
export const CALENDAR_EVENT_TYPES: CalendarEventType[] = ['EVENT', 'ROSTER', 'HELP_NEEDED'];

export type TaskType = 'SITE' | 'DISPLAY' | 'AIRFRAME';
export const TASK_TYPES: TaskType[] = ['SITE', 'DISPLAY', 'AIRFRAME'];

export type TaskUrgency = 'ROUTINE' | 'MODERATE' | 'URGENT';
export const TASK_URGENCIES: TaskUrgency[] = ['ROUTINE', 'MODERATE', 'URGENT'];

export type JobScheduleType = 'ONE_OFF' | 'WEEKLY' | 'MONTHLY';
export const JOB_SCHEDULE_TYPES: JobScheduleType[] = ['ONE_OFF', 'WEEKLY', 'MONTHLY'];
