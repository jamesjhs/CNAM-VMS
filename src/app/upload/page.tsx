import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import UploadForm from '@/components/UploadForm';

export default async function UploadPage() {
  await requireCapability('admin:files.write');

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">File Upload</h1>
        <p className="text-gray-500 mb-8">
          Upload files for museum use. Allowed types: images, PDF, Word, Excel, CSV, TXT. Max {process.env.UPLOAD_MAX_SIZE_MB ?? 10}MB.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <UploadForm />
        </div>
      </main>
    </div>
  );
}
