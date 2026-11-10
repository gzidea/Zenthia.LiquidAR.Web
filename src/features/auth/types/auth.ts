export interface LoginRequest {
  userName: string;
  password: string;
  applicationId: number;
}
/** Exact wire DTO; token properties never enter application state. */
export interface LoginResponse {
  accessTokenRemainingMilliseconds: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: number;
  userName: string;
  requiresPasswordChange: boolean;
  firstLogin: boolean;
  isSuperAdmin: boolean;
}
export type LoginSession = Omit<
  LoginResponse,
  'accessToken' | 'refreshToken' | 'accessTokenRemainingMilliseconds'
>;
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
export interface UserDto {
  id: number;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  tenantId: number;
  phoneNumber: string | null;
  startDate: string;
  userGuid: string;
}
export type AnonymousReason = 'initial' | 'expired' | 'logout';
export type AuthSession =
  | { status: 'initializing' }
  | { status: 'restore-error' }
  | { status: 'anonymous'; reason: AnonymousReason }
  | { status: 'authenticated' | 'password-required'; user: LoginSession };
