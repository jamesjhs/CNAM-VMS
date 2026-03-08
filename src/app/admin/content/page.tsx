import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PRIVACY_POLICY } from '@/lib/default-privacy-policy';
import Link from 'next/link';
import { savePrivacyPolicy } from './actions';

export const metadata = {
  title: 'Site Content — Admin',
};

export default async function AdminContentPage() {
  await requireCapability('admin:theme.write');

  const record = await prisma.siteContent.findUnique({ where: { key: 'privacy-policy' } });
  const currentContent = record?.content ?? DEFAULT_PRIVACY_POLICY;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Site Content</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Site Content</h1>
            <p className="text-gray-500">Edit publicly visible site pages such as the Privacy &amp; Cookie Policy.</p>
          </div>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Preview policy ↗
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <strong>⚠ AI-Generated Content:</strong> The default policy text was generated with
            the assistance of artificial intelligence. Review and edit it carefully before it is
            treated as an official document. Consider seeking legal advice before formal adoption.
          </div>

          <h2 className="font-semibold text-gray-900 mb-1">Privacy &amp; Cookie Policy</h2>
          <p className="text-xs text-gray-500 mb-4">
            Displayed at{' '}
            <Link href="/privacy" className="underline hover:text-gray-700">
              /privacy
            </Link>
            {record?.updatedAt && (
              <>
                {' '}· Last saved{' '}
                {record.updatedAt.toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </>
            )}
          </p>

          <form
            action={async (formData: FormData) => {
              'use server';
              const content = formData.get('content') as string;
              await savePrivacyPolicy(content);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="content" className="block text-xs font-medium text-gray-500 mb-1">
                Policy content (plain text)
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={40}
                defaultValue={currentContent}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Preview
              </Link>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Save changes
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
