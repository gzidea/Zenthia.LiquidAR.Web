import type { LoginResponse, UserDto } from '@/features/auth/types/auth';

export function loginResponse(
  overrides: Partial<LoginResponse> = {},
): LoginResponse {
  return {
    accessTokenRemainingMilliseconds: Math.max(
      0,
      Date.parse(
        overrides.expiresAt ?? new Date(Date.now() + 900000).toISOString(),
      ) - Date.now(),
    ),
    accessToken: 'test-only-access',
    refreshToken: 'test-only-refresh',
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    userId: 7,
    userName: 'ana',
    firstLogin: false,
    requiresPasswordChange: false,
    isSuperAdmin: false,
    ...overrides,
  };
}
export const changedUser: UserDto = {
  id: 7,
  userName: 'ana',
  firstName: 'Ana',
  lastName: 'Prueba',
  email: 'ana@example.test',
  active: true,
  tenantId: 2,
  phoneNumber: null,
  startDate: '2026-01-01',
  userGuid: '00000000-0000-0000-0000-000000000007',
};
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
