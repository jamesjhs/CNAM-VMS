import { requireAuth } from '@/lib/auth-helpers';

export default async function CoordinationMessagesPage() {
  await requireAuth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Messages</h1>
        <p className="text-gray-600">Communicate with individual volunteers or groups</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Composer */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Compose Message</h2>

          {/* Recipient Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Send to:</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input type="radio" name="recipientType" value="individual" defaultChecked className="w-4 h-4" />
                <span className="ml-2 text-sm text-gray-700">Individual Volunteer</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="recipientType" value="group" className="w-4 h-4" />
                <span className="ml-2 text-sm text-gray-700">Group / Team</span>
              </label>
            </div>
          </div>

          {/* Message Text */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              placeholder="Type your message here..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">Message composition UI ready</p>
          </div>

          {/* Send Button */}
          <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 font-medium">
            Send Message
          </button>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-3">💬 Messaging Tips</h3>
            <ul className="text-xs text-blue-800 space-y-2">
              <li>• Keep messages clear and concise</li>
              <li>• Use professional language</li>
              <li>• Include relevant details and context</li>
              <li>• Recipients will receive notifications</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-semibold text-green-900 mb-3">✓ Feature Active</h3>
            <p className="text-xs text-green-800">
              You have access to the staff messaging system for communicating with volunteers and groups.
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">📧 Staff Messaging System</h3>
        <p className="text-sm text-blue-800 mb-3">
          This section allows you to send messages to volunteers or groups. As a staff member, you can:
        </p>
        <ul className="text-sm text-blue-800 space-y-1 ml-4">
          <li>• Send targeted messages to individual volunteers</li>
          <li>• Broadcast messages to entire teams or groups</li>
          <li>• Keep all communication logged for reference</li>
          <li>• Coordinate schedules and availability changes</li>
        </ul>
        <p className="text-xs text-blue-700 mt-3">
          <strong>Implementation Status:</strong> The messaging interface is now available. Backend API integration is in progress for full message delivery and history tracking.
        </p>
      </div>
    </div>
  );
}
