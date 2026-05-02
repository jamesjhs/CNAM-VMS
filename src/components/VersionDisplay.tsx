import { APP_VERSION } from '@/lib/version';

export default function VersionDisplay() {
  return (
    <div className="text-xs text-gray-500 py-2 px-3 border-t border-gray-200 dark:border-gray-700">
      v{APP_VERSION}
    </div>
  );
}
