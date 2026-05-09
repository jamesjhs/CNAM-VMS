import Link from 'next/link';

interface UserLinkProps {
  userId: string;
  name: string | null;
  email: string;
  /** Extra Tailwind classes applied to the outer element */
  className?: string;
}

/**
 * Renders a user's display name as a clickable link that opens a direct
 * message thread with that user (/messages/[userId]).
 *
 * A small chat icon fades in on hover to make the affordance clear without
 * cluttering dense lists.
 *
 * Do NOT use this component inside /messages pages.
 */
export default function UserLink({ userId, name, email, className = '' }: UserLinkProps) {
  const display = name ?? email;
  return (
    <Link
      href={`/messages/${userId}`}
      title={`Message ${display}`}
      className={`inline-flex items-center gap-1 group ${className}`}
    >
      <span>{display}</span>
      <span
        aria-hidden="true"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 text-xs select-none"
      >
        💬
      </span>
    </Link>
  );
}
