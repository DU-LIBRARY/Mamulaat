import type { UserProfile } from '../types';

/** Name shown for a person in admin screens. Never falls back to the email — admins don't see student emails. */
export function displayName(u: Pick<UserProfile, 'name'> | null | undefined): string {
  return u?.name?.trim() || 'Unnamed student';
}

/** First name and the first letter of the second, for tight tables: "Ahmed Khan Ali" → "Ahmed K". */
export function shortName(u: Pick<UserProfile, 'name'> | null | undefined): string {
  const parts = displayName(u).split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0).toUpperCase()}` : parts[0];
}
