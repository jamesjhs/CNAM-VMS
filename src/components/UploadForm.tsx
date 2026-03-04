'use client';

import { useState } from 'react';

export default function UploadForm() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ filename: string; size: number } | null>(null);

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
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage('File uploaded successfully!');
        setResult({ filename: data.filename, size: data.size });
        form.reset();
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
          Select file
        </label>
        <input
          id="file"
          type="file"
          name="file"
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.docx,.xlsx"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'uploading'}
        className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload File'}
      </button>

      {status === 'success' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <p>{message}</p>
          {result && (
            <p className="mt-1 text-xs text-green-600">
              Saved as: {result.filename} ({Math.round(result.size / 1024)}KB)
            </p>
          )}
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
