import NavBar from '@/components/NavBar';
import { getDb } from '@/lib/db';
import { getDefaultPrivacyPolicy } from '@/lib/default-privacy-policy';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy & Cookie Policy — CNAM VMS',
};

export default async function PrivacyPolicyPage() {
  const db = getDb();
  const record = db.prepare("SELECT content FROM site_content WHERE key = 'privacy-policy'").get() as { content: string } | undefined;
  const content = record?.content ?? getDefaultPrivacyPolicy();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Privacy &amp; Cookie Policy</span>
        </nav>

        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-10">
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <strong>⚠ AI-Generated Policy Notice:</strong> This privacy and cookie policy was drafted
            with the assistance of artificial intelligence. It reflects the actual technical
            characteristics of this system but has not been formally reviewed by a qualified legal
            professional. It is provided in good faith and should be considered a working draft.
          </div>

          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
            {content}
          </pre>
        </div>
      </main>
    </div>
  );
}
