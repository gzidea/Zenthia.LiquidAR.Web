import { ApiError } from '@/services/http/ApiError';

export interface SessionTiming {
  readonly deadline: number;
}

// Per-tab, monotonic and never persisted. Absolute UTC dates are display metadata only.
export function captureSessionTiming(
  remainingMilliseconds: number,
  requestStarted = performance.now(),
): SessionTiming {
  if (
    !Number.isSafeInteger(remainingMilliseconds) ||
    remainingMilliseconds < 0 ||
    !Number.isFinite(requestStarted)
  )
    throw new Error('Duración de sesión inválida.');
  // Subtract the full round trip conservatively instead of restarting the token
  // lifetime when the response arrives or when /users/me completes.
  return Object.freeze({ deadline: requestStarted + remainingMilliseconds });
}

export function remainingSessionTime(timing: SessionTiming): number {
  return timing.deadline - performance.now();
}
export function captureServerSessionTiming(
  remainingMilliseconds: number | undefined,
  expiresAt: string,
  serverDate: string | null,
  requestStarted: number,
): SessionTiming {
  if (remainingMilliseconds !== undefined)
    return captureSessionTiming(remainingMilliseconds, requestStarted);
  const serverNow = serverDate === null ? NaN : Date.parse(serverDate);
  const expiry = Date.parse(expiresAt);
  if (
    !Number.isFinite(serverNow) ||
    !Number.isFinite(expiry) ||
    new Date(serverNow).toUTCString() !== serverDate
  )
    throw new ApiError(
      'contract',
      'Security no informó la duración de la sesión ni una fecha de servidor válida. Actualizá Security o revisá la cabecera Date del gateway.',
    );
  // Compatibility with the previous Security response. HTTP Date has second
  // precision; reserve one extra second plus the full RTT, never the PC's UTC.
  const remaining = Math.max(
    0,
    Math.floor(expiry / 1000) * 1000 - serverNow - 1000,
  );
  return captureSessionTiming(remaining, requestStarted);
}
