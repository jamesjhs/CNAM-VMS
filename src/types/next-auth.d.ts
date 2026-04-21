import type { DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      status: string;
      capabilities: string[];
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    /** User account status cached in the token (refreshed every 5 minutes). */
    status?: string;
    /** Whether the user must change their password (cached in token). */
    mustChangePassword?: boolean;
    /** Granted capability keys cached in the token (refreshed every 5 minutes). */
    capabilities?: string[];
    /** Unix timestamp (seconds) when capabilities/status were last refreshed. */
    capabilitiesAt?: number;
  }
}
