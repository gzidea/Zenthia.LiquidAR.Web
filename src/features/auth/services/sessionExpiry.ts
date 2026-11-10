import { useAuthStore } from '../stores/authStore';
import { getSessionGeneration, getSessionRemainingMs } from './sessionTokens';

export const SESSION_RESUME_WINDOW_MS = 30_000;

export function sessionCredentials() {
  const { session } = useAuthStore.getState();
  return 'user' in session ? getSessionGeneration() : null;
}

export function canRequestWithSession() {
  return (
    !('user' in useAuthStore.getState().session) ||
    (getSessionRemainingMs() ?? 0) > 0
  );
}

export function canResumeSession() {
  if (!('user' in useAuthStore.getState().session)) return false;
  const remaining = getSessionRemainingMs();
  if (remaining === null) return false;
  return remaining <= 0 && remaining > -SESSION_RESUME_WINDOW_MS;
}
