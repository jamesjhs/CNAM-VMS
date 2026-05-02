import NavBar from '@/components/NavBar';
import Link from 'next/link';

export const metadata = {
  title: 'Help & User Manual — CNAM VMS',
  description: 'Complete guide for using the CNAM Volunteer Management System',
};

export const dynamic = 'force-dynamic';

export default function HelpPage() {
  const helpSections = [
    {
      id: 'getting-started',
      title: '🚀 Getting Started',
      content: [
        {
          heading: 'Welcome to CNAM VMS',
          text: 'The CNAM Volunteer Management System helps volunteers, staff, and administrators manage volunteering activities, schedules, and team collaboration.',
        },
        {
          heading: 'First Login',
          text: 'When you first log in, you will see your personalized dashboard. Here you can view upcoming events, your profile, and team announcements.',
        },
      ],
    },
    {
      id: 'volunteers',
      title: '👥 Volunteer Features',
      content: [
        {
          heading: 'Dashboard Overview',
          text: 'Your dashboard displays upcoming events you can sign up for, your current volunteer hours, team announcements, and quick access to your profile and schedule.',
        },
        {
          heading: 'Schedule & Availability',
          text: 'Browse upcoming events and shifts. Click "Sign Up" to register for events that match your availability. You can also set your general availability preferences in your profile.',
        },
        {
          heading: 'Your Profile',
          text: 'Update your name, phone number, email, availability preferences, and other information. This helps coordinators match you with suitable events.',
        },
        {
          heading: 'Teams & Tasks',
          text: 'View your assigned team, upcoming team projects, and record your work hours on specific tasks. This helps track your volunteering contributions.',
        },
        {
          heading: 'Announcements',
          text: 'Stay informed with the latest news, updates, and important information shared by administrators and team leads.',
        },
      ],
    },
    {
      id: 'staff',
      title: '👨‍💼 Staff Features',
      content: [
        {
          heading: 'Staff Dashboard',
          text: 'The Staff section provides a complete view of the timetabling system. You have access to volunteers, their availability, upcoming projects, and messaging.',
        },
        {
          heading: 'View All Volunteers',
          text: 'See a complete list of all volunteers. Filter by availability, team assignment, or volunteer status to find the right people for upcoming events.',
        },
        {
          heading: 'Volunteer Availability',
          text: 'View a calendar showing which volunteers are available on specific dates. This helps with scheduling and event coordination.',
        },
        {
          heading: 'Upcoming Projects',
          text: 'See all upcoming projects and team assignments. Track project progress, assign volunteers, and manage team tasks.',
        },
        {
          heading: 'Messaging',
          text: 'Send messages to individual volunteers or groups. Keep everyone informed, coordinate schedules, and communicate important information.',
        },
      ],
    },
    {
      id: 'admin',
      title: '🔐 Admin Features',
      content: [
        {
          heading: 'Administration Panel',
          text: 'The Admin section provides full control over the system. Only users with admin privileges can access these features.',
        },
        {
          heading: 'User Management',
          text: 'Create, edit, and delete user accounts. Assign roles and capabilities to control what each user can do in the system.',
        },
        {
          heading: 'Roles & Capabilities',
          text: 'Define custom roles and assign specific capabilities to them. Control granular permissions for different types of users.',
        },
        {
          heading: 'Teams Management',
          text: 'Create teams, assign members, and manage team-related content and workflows.',
        },
        {
          heading: 'Audit Log',
          text: 'View a complete log of all system changes for security and compliance purposes.',
        },
      ],
    },
    {
      id: 'faq',
      title: '❓ Frequently Asked Questions',
      content: [
        {
          heading: 'How do I sign up for an event?',
          text: 'Go to Schedule & Availability, find an event you\'re interested in, and click the "Sign Up" button. The organizer will confirm your registration.',
        },
        {
          heading: 'Can I change my availability?',
          text: 'Yes! Go to your Profile and update your availability preferences. Staff and admins can see your availability when scheduling events.',
        },
        {
          heading: 'How do I contact the team?',
          text: 'If you have a question, check the Announcements page first. If you\'re a staff member, use the Messaging feature to send messages to volunteers.',
        },
        {
          heading: 'How do I log my volunteer hours?',
          text: 'After completing work on a task, go to Teams & Tasks and record your hours in the task details. Your hours will be added to your total volunteer time.',
        },
        {
          heading: 'Who do I contact for technical support?',
          text: 'Check the footer of any page for the privacy policy and support links. Administrators can also reach out through the messaging system.',
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: '🔧 Troubleshooting',
      content: [
        {
          heading: 'I forgot my password',
          text: 'On the login page, click "Forgot Password?" to reset your password. You\'ll receive an email with instructions.',
        },
        {
          heading: 'I can\'t see certain menu items',
          text: 'Some features are only available to specific user types (staff, admin). Make sure your account has the appropriate role assigned.',
        },
        {
          heading: 'My changes aren\'t showing up',
          text: 'Try refreshing the page (F5 or Ctrl+R). If the issue persists, log out and log back in.',
        },
        {
          heading: 'I see an error message',
          text: 'Note the exact error message and take a screenshot if possible. Contact your administrator with these details for help.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-gray-700">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Help</span>
        </nav>

        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-10 shadow-sm">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Help & User Manual</h1>
            <p className="text-gray-600">Complete guide for using the CNAM Volunteer Management System</p>
          </div>

          {/* Help Sections */}
          <div className="space-y-8">
            {helpSections.map((section) => (
              <div key={section.id} className="border-b border-gray-200 pb-8 last:border-b-0">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                <div className="space-y-4">
                  {section.content.map((item, idx) => (
                    <div key={idx} className="ml-2">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.heading}</h3>
                      <p className="text-gray-700 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/dashboard" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <strong className="text-lg">📊 Dashboard</strong>
            <p className="text-sm text-gray-600 mt-1">View your overview and quick actions</p>
          </Link>
          <Link href="/profile" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <strong className="text-lg">👤 My Profile</strong>
            <p className="text-sm text-gray-600 mt-1">Update your personal information</p>
          </Link>
          <Link href="/schedule" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <strong className="text-lg">📅 Schedule</strong>
            <p className="text-sm text-gray-600 mt-1">View and sign up for events</p>
          </Link>
          <Link href="/teams" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <strong className="text-lg">👥 Teams</strong>
            <p className="text-sm text-gray-600 mt-1">View team projects and tasks</p>
          </Link>
          <Link href="/announcements" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <strong className="text-lg">📢 Announcements</strong>
            <p className="text-sm text-gray-600 mt-1">Read latest news and updates</p>
          </Link>
          <Link href="/files" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <strong className="text-lg">📁 Files</strong>
            <p className="text-sm text-gray-600 mt-1">Access shared files and documents</p>
          </Link>
        </div>

        {/* Footer Note */}
        <div className="mt-8 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <strong>💡 Tip:</strong> Use your browser&apos;s Find function (Ctrl+F or Cmd+F) to search for specific keywords on this page.
        </div>
      </main>
    </div>
  );
}
