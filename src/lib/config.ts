export function readConfig(env: ImportMetaEnv) {
  const rawId = env.VITE_SECURITY_APPLICATION_ID ?? '1';
  const applicationId = Number(rawId);
  const baseURL = env.VITE_SECURITY_BASE_URL || '/api';
  const liquidarBaseURL = env.VITE_LIQUIDAR_BASE_URL || '/api';

  const validId =
    /^\d+$/.test(rawId) &&
    Number.isSafeInteger(applicationId) &&
    applicationId > 0 &&
    applicationId <= 2147483647;
  const validBase = true;
  // baseURL.startsWith('/') &&
  // !baseURL.startsWith('//') &&
  // !/[?#\\]/.test(baseURL);
  console.log('Es valido: ', validBase);
  return {
    applicationId,
    baseURL: validBase ? baseURL.replace(/\/$/, '') : '/api',
    liquidarBaseURL: liquidarBaseURL.replace(/\/$/, ''),
    error:
      !validId || !validBase
        ? 'El acceso todavía no está configurado. Contactá al administrador.'
        : null,
  };
}
export const config = readConfig(import.meta.env);
