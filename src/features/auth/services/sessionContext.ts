import { loginSessionSchema } from '../schemas/authSchemas';
import type { LoginSession } from '../types/auth';

const key = 'liquidar.session-context';

// UI context only. A successful server refresh is always required to restore access.
export function saveSessionContext(user: LoginSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(loginSessionSchema.parse(user)));
  } catch {
    // Storage can be unavailable; the current in-memory session remains usable.
  }
}

export function readSessionContext(): LoginSession | null {
  try {
    const parsed = loginSessionSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? 'null'),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearSessionContext() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // No persistent credentials to clear.
  }
}
