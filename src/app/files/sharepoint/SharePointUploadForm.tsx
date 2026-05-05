'use client';

import { useState } from 'react';

interface SharePointUploadFormProps {
  folderPath: string;
  onSuccess?: () => void;
}

export default function SharePointUploadForm({ folderPath, onSuccess }: SharePointUploadFormProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];

    if (!file) {
      setStatus('error');
      setMessage('Please select a file.');
      return;
    }

    setStatus('uploading');
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderPath', folderPath);

    try {
      const res = await fetch('/api/sharepoint/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(`"${data.name}" uploaded successfully.`);
        form.reset();
        onSuccess?.();
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Upload failed.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="sp-file" className="block text-sm font-medium text-gray-700 mb-1">
          Select file
        </label>
        <input
          id="sp-file"
          type="file"
          name="file"
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.docx,.xlsx"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'uploading'}
        className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {status === 'uploading' ? 'Uploading…' : 'Upload to SharePoint'}
      </button>

      {status === 'success' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {message}
        </div>
      )}
      {status === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {message}
        </div>
      )}
    </form>
  );
}
