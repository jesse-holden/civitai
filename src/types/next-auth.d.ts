import type { DefaultSession } from 'next-auth';
import { extendedSessionUser } from '~/utils/session-helpers';

interface ExtendedUser {
  id: number;
  blurNsfw: boolean; // client only
  username: string;
  browsingLevel: number;
  onboarding: number;
  image?: string;
  email?: string;
  emailVerified?: Date;
  createdAt?: Date;
  isModerator?: boolean;
  customerId?: string; // could be fetched
  subscriptionId?: string; // could be fetched
  tier?: string;
  muted?: boolean;
  bannedAt?: Date;
  autoplayGifs?: boolean; // client only - could be cookie setting
  permissions?: string[];
  filePreferences?: UserFilePreferences;
  leaderboardShowcase?: string; // client only
  referral?: { id: number }; // client only

  // TODO.briant - clean up user session data
  /*
    remove `deletedAt` from session user data
    remove `emailVerified`, update user account page to make call to get current user data
   */
}

declare module 'next-auth' {
  interface DefaultUser extends ExtendedUser {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }

  interface TokenUser extends ExtendedUser, DefaultSession['user'] {}
  type SessionUser = NonNullable<ReturnType<typeof extendedSessionUser>>;
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user?: ExtendedUser & DefaultSession['user'];
    error?: string;
  }
}
