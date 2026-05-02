import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackDate } from '@/lib/db';
import Link from 'next/link';
import {
  createMuseumStatus,
  deleteMuseumStatus,
  createOpeningHours,
  updateOpeningHours,
  deleteOpeningHours,
  createBankHoliday,
  updateBankHoliday,
  deleteBankHoliday,
} from './actions';

export default async function MuseumPage() {
  await requireCapability('admin:museum.write');

  const db = getDb();

  type StatusRow = { date: string; title: string; description: string | null };
  const statuses = db.prepare('SELECT date, title, description FROM museum_status ORDER BY date DESC').all() as StatusRow[];

  type OpeningHoursRow = { id: string; startDate: string; endDate: string; status: string; notes: string | null };
  const openingHours = db.prepare(
    'SELECT id, startDate, endDate, status, notes FROM museum_opening_hours ORDER BY startDate DESC',
  ).all() as OpeningHoursRow[];

  type BankHolidayRow = { date: string; name: string };
  const bankHolidays = db.prepare('SELECT date, name FROM bank_holidays ORDER BY date DESC').all() as BankHolidayRow[];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Museum Status</span>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">Museum Status &amp; Hours</h1>
        <p className="text-gray-600 mb-8">Manage museum announcements, opening hours, and bank holidays</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Museum Status ─────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Daily Status &amp; Announcements</h2>
              <p className="text-sm text-gray-600 mb-4">
                Add announcements like &quot;Museum opening late&quot;, &quot;Not open today&quot;, or &quot;Opening hours changed&quot;
              </p>

              <form
                action={async (formData: FormData) => {
                  'use server';
                  const date = formData.get('date') as string;
                  const title = formData.get('title') as string;
                  const description = formData.get('description') as string;
                  await createMuseumStatus(date, title, description || null);
                }}
                className="space-y-3 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Title (e.g., &quot;Opening Late&quot;)</label>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="e.g., Opening Late, Closed, Hours Changed"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <input
                    name="description"
                    type="text"
                    placeholder="e.g., Opening at 10am instead of 9am"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Add Status
                </button>
              </form>

              <div className="space-y-2">
                {statuses.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No statuses added yet</p>
                ) : (
                  statuses.map((status) => (
                    <div key={status.date} className="flex items-start justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{status.title}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(status.date).toLocaleDateString('en-GB')}</div>
                        {status.description && <div className="text-xs text-gray-600 mt-1">{status.description}</div>}
                      </div>
                      <form action={deleteMuseumStatus.bind(null, status.date)}>
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:text-red-800 font-medium ml-2 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ─── Opening Hours ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Opening Hours &amp; Closures</h2>
              <p className="text-sm text-gray-600 mb-4">
                Set date ranges for special hours (e.g., &quot;Closed to public&quot;, &quot;Open til late&quot;)
              </p>

              <form
                action={async (formData: FormData) => {
                  'use server';
                  const startDate = formData.get('startDate') as string;
                  const endDate = formData.get('endDate') as string;
                  const status = formData.get('status') as string;
                  const notes = formData.get('notes') as string;
                  await createOpeningHours(startDate, endDate, status, notes || null);
                }}
                className="space-y-3 mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      name="startDate"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      name="endDate"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select status...</option>
                    <option value="Closed to public">Closed to public</option>
                    <option value="Museum closed">Museum closed</option>
                    <option value="Open til late">Open til late</option>
                    <option value="Early opening">Early opening</option>
                    <option value="Restricted hours">Restricted hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <input
                    name="notes"
                    type="text"
                    placeholder="e.g., Special event, staff training"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Add Opening Hours
                </button>
              </form>

              <div className="space-y-2">
                {openingHours.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No opening hours set yet</p>
                ) : (
                  openingHours.map((hours) => (
                    <div key={hours.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{hours.status}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(hours.startDate).toLocaleDateString('en-GB')} - {new Date(hours.endDate).toLocaleDateString('en-GB')}
                        </div>
                        {hours.notes && <div className="text-xs text-gray-600 mt-1">{hours.notes}</div>}
                      </div>
                      <form action={deleteOpeningHours.bind(null, hours.id)}>
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:text-red-800 font-medium ml-2 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ─── Bank Holidays ────────────────────────────────────────── */}
          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">UK Bank Holidays</h2>
              <p className="text-sm text-gray-600 mb-4">
                Add and manage bank holidays to be displayed in the calendar
              </p>

              <form
                action={async (formData: FormData) => {
                  'use server';
                  const date = formData.get('date') as string;
                  const name = formData.get('name') as string;
                  await createBankHoliday(date, name);
                }}
                className="space-y-3 mb-6 p-4 bg-green-50 rounded-lg border border-green-200"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    name="date"
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Holiday Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="e.g., Easter Monday"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Add Holiday
                </button>
              </form>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {bankHolidays.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No bank holidays added</p>
                ) : (
                  bankHolidays.map((holiday) => (
                    <div key={holiday.date} className="flex items-start justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">{holiday.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(holiday.date).toLocaleDateString('en-GB')}</div>
                      </div>
                      <form action={deleteBankHoliday.bind(null, holiday.date)}>
                        <button
                          type="submit"
                          className="text-xs text-red-600 hover:text-red-800 font-medium ml-2 whitespace-nowrap flex-shrink-0"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
