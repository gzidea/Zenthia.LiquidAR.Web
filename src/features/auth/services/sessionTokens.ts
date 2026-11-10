import {
  captureSessionTiming,
  remainingSessionTime,
  type SessionTiming,
} from './sessionClock';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenRemainingMilliseconds?: number;
}

// Private, tab-local memory. Neither token is persisted or exposed through UI state.
let current: SessionTokens | null = null;
let timing: SessionTiming | null = null;
let generation = 0;

export function storeSessionTokens(
  tokens: SessionTokens | undefined,
  receivedTiming?: SessionTiming,
) {
  timing =
    receivedTiming ??
    captureSessionTiming(tokens?.accessTokenRemainingMilliseconds ?? 0);
  generation++;
  current = tokens
    ? { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
    : null;
}

export function clearSessionTokens() {
  current = null;
  timing = null;
  generation++;
}

export function getSessionRemainingMs(): number | null {
  return timing ? remainingSessionTime(timing) : null;
}

export function getSessionGeneration(): string | null {
  return timing ? String(generation) : null;
}

export function getAccessToken(): string | null {
  if (!current || (getSessionRemainingMs() ?? 0) <= 0) {
    current = null;
    return null;
  }
  return current.accessToken;
}
