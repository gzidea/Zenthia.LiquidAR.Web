import { useEffect, useState } from 'react';
import {
  authService,
  expireSession,
} from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { SessionExpiredDialog } from '@/features/auth/components/SessionExpiredDialog';
import { SESSION_RESUME_WINDOW_MS } from '@/features/auth/services/sessionExpiry';
import { getSessionRemainingMs } from '@/features/auth/services/sessionTokens';

export function SessionLifecycle() {
  const session = useAuthStore((state) => state.session);
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    authService.initialize();
  }, []);
  useEffect(() => {
    if (!('user' in session)) {
      setSeconds(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const remaining = getSessionRemainingMs();
      if (remaining === null) {
        setSeconds(null);
        expireSession();
        return;
      }
      if (remaining <= -SESSION_RESUME_WINDOW_MS) {
        setSeconds(null);
        expireSession();
      } else if (remaining <= 0) {
        const graceRemaining = remaining + SESSION_RESUME_WINDOW_MS;
        setSeconds(Math.ceil(graceRemaining / 1000));
        timer = setTimeout(check, Math.min(graceRemaining, 1000));
      } else {
        setSeconds(null);
        timer = setTimeout(check, Math.min(remaining, 2147483647));
      }
    };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [session]);
  return seconds !== null &&
    'user' in session &&
    (getSessionRemainingMs() ?? 0) <= 0 ? (
    <SessionExpiredDialog key={session.user.expiresAt} seconds={seconds} />
  ) : null;
}
