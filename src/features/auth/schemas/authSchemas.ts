import { z } from 'zod';

export const loginSchema = z.object({
  userName: z.string().trim().min(1, 'Ingresá tu usuario o email.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual.'),
    newPassword: z.string().min(1, 'Ingresá la nueva contraseña.'),
    confirmPassword: z.string().min(1, 'Confirmá la nueva contraseña.'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

// Zod strips unknown fields, including both tokens returned by Security.
export const loginSessionSchema = z.object({
  userId: z.number().int().positive(),
  userName: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
  requiresPasswordChange: z.boolean(),
  firstLogin: z.boolean(),
  isSuperAdmin: z.boolean(),
});
export const loginResponseSchema = loginSessionSchema.extend({
  accessTokenRemainingMilliseconds: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});
export type LoginFields = z.infer<typeof loginSchema>;

export const refreshResponseSchema = z.object({
  accessTokenRemainingMilliseconds: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiry: z.iso.datetime({ offset: true }),
  refreshTokenExpiry: z.iso.datetime({ offset: true }),
});

export const restoredIdentitySchema = z.object({
  user: z.object({
    id: z.number().int().positive(),
    userName: z.string().min(1),
  }),
  actor: z.object({
    userId: z.number().int().positive(),
    applicationId: z.number().int().positive(),
    isSuperAdmin: z.boolean(),
  }),
});
