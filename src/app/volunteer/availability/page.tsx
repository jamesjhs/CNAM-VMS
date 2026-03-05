import { requireActiveUser } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import { updateVolunteerAvailability } from '@/app/admin/users/actions';

export const VOLUNTEER_ACTIVITIES = [
  { key: 'site_works', label: 'Site Works', description: 'General site maintenance and improvements' },
  { key: 'groundskeeping', label: 'Groundskeeping', description: 'Maintaining the museum grounds and green spaces' },
  { key: 'aircraft_maintenance', label: 'Aircraft Maintenance', description: 'Assisting with aircraft restoration and maintenance' },
  { key: 'shop', label: 'Shop', description: 'Serving customers in the museum gift shop' },
  { key: 'tearoom', label: 'Tearoom', description: 'Serving in the tearoom/café' },
  { key: 'aircraft_guide', label: 'Aircraft Guide', description: 'Guiding visitors around the aircraft collection' },
  { key: 'museum_front_of_house', label: 'Museum Front of House', description: 'Welcoming visitors at the museum entrance' },
] as const;

export default async function AvailabilityPage() {
  const user = await requireActiveUser();

  const availability = await prisma.volunteerAvailability.findUnique({
    where: { userId: user.id },
  });

  const selectedActivities = new Set(availability?.activities ?? []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">My Availability</h1>
          <p className="text-gray-500">
            Select the volunteer activities you are available and willing to help with.
            Your preferences will be visible to team coordinators.
          </p>
        </div>

        <form
          action={async (formData: FormData) => {
            'use server';
            const activities = VOLUNTEER_ACTIVITIES
              .map((a) => a.key)
              .filter((key) => formData.get(`activity_${key}`) === 'on');
            const notes = formData.get('notes') as string;
            await updateVolunteerAvailability(activities, notes);
          }}
          className="space-y-6"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Volunteer Activities</h2>
            <p className="text-sm text-gray-500 mb-5">
              Tick all activities you would like to help with:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VOLUNTEER_ACTIVITIES.map((activity) => {
                const checked = selectedActivities.has(activity.key);
                return (
                  <label
                    key={activity.key}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={`activity_${activity.key}`}
                      defaultChecked={checked}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">{activity.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{activity.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Additional Notes</h2>
            <p className="text-sm text-gray-500 mb-3">
              Any additional information about your availability or preferences:
            </p>
            <textarea
              name="notes"
              rows={4}
              defaultValue={availability?.notes ?? ''}
              placeholder="e.g. Available weekends only, or any skills you'd like to highlight..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </form>

        {availability && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            ✓ Your preferences were last updated on{' '}
            {availability.updatedAt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            .
          </div>
        )}
      </main>
    </div>
  );
}
