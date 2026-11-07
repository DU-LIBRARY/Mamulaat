import type { UserProfile } from '../types';

/** Name shown for a person in admin screens. Never falls back to the email — admins don't see student emails. */
export function displayName(u: Pick<UserProfile, 'name'> | null | undefined): string {
  return u?.name?.trim() || 'Unnamed student';
}
