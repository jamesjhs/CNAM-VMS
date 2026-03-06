'use client';

import { useState } from 'react';
import { JOB_COLOURS, WEEK_DAY_LABELS } from '@/lib/calendar';

const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

type JobFormProps = {
  mode: 'create';
  action: (formData: FormData) => Promise<void>;
} | {
  mode: 'edit';
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
  };
  action: (formData: FormData) => Promise<void>;
};

export default function JobForm(props: JobFormProps) {
  const isEdit = props.mode === 'edit';
  const job = isEdit ? props.job : null;

  const [scheduleType, setScheduleType] = useState<string>(job?.scheduleType ?? 'ONE_OFF');
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>(job?.weekDays ?? []);
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>(job?.monthDays ?? []);

  function toggleWeekDay(d: number) {
    setSelectedWeekDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  function toggleMonthDay(d: number) {
    setSelectedMonthDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  return (
    <form action={props.action} className="space-y-4">
      {isEdit && <input type="hidden" name="jobId" value={job!.id} />}

      {/* Hidden arrays — submitted as JSON strings, parsed on the server side */}
      <input type="hidden" name="weekDaysJson" value={JSON.stringify(selectedWeekDays)} />
      <input type="hidden" name="monthDaysJson" value={JSON.stringify(selectedMonthDays)} />

      {/* Title / Description */}
      <div className={`grid gap-4 ${isEdit ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Job title *</label>
          <input
            name="title"
            type="text"
            required
            defaultValue={job?.title ?? ''}
            placeholder="e.g. Grass Cutting"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
          <input
            name="description"
            type="text"
            defaultValue={job?.description ?? ''}
            placeholder="Brief description"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Type, Colour */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Availability type</label>
          <select
            name="isRolling"
            defaultValue={job?.isRolling ? 'rolling' : 'rostered'}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rolling">Rolling — always available</option>
            <option value="rostered">Rostered — via calendar only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Colour</label>
          <select
            name="colour"
            defaultValue={job?.colour ?? '#6366f1'}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {JOB_COLOURS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Recurrence ────────────────────────────────────────────────── */}
      <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Schedule / recurrence</label>
          <select
            name="scheduleType"
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ONE_OFF">One-off (admin places on calendar manually)</option>
            <option value="WEEKLY">Weekly — repeats on selected days of the week</option>
            <option value="MONTHLY">Monthly — repeats on selected days of the month</option>
          </select>
        </div>

        {/* Weekly: day-of-week checkboxes */}
        {scheduleType === 'WEEKLY' && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Repeats every:</p>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleWeekDay(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedWeekDays.includes(idx)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {selectedWeekDays.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Select at least one day.</p>
            )}
          </div>
        )}

        {/* Monthly: day-of-month grid */}
        {scheduleType === 'MONTHLY' && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Repeats on these days of the month:</p>
            <div className="flex flex-wrap gap-1.5">
              {MONTH_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleMonthDay(d)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${
                    selectedMonthDays.includes(d)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {selectedMonthDays.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Select at least one day of the month.</p>
            )}
          </div>
        )}

        {/* Default time + max signups (shown when job has recurrence) */}
        {scheduleType !== 'ONE_OFF' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Default start time</label>
              <input
                name="defaultStartTime"
                type="time"
                defaultValue={job?.defaultStartTime ?? ''}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Default end time</label>
              <input
                name="defaultEndTime"
                type="time"
                defaultValue={job?.defaultEndTime ?? ''}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max volunteers</label>
              <input
                name="defaultMaxSignups"
                type="number"
                min="1"
                defaultValue={job?.defaultMaxSignups ?? ''}
                placeholder="∞"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          {isEdit ? 'Save Changes' : 'Add Job'}
        </button>
      </div>
    </form>
  );
}
