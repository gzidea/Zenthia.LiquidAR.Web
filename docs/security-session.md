# Security: contrato observado y pendientes

**Evaluación del 28 de octubre de 2026:** el problema de relojes, la propuesta de duración relativa/reloj monotónico y el diálogo con extensión o cierre inmediato se documentan en [Tokens para LiquidAR](tokens-liquidar.md). La corrección temporal ya está implementada; prefiere la duración de Security y admite la versión anterior con una cabecera Date válida del servidor. Se conserva la ventana de renovación actual.

**Actualización vigente (20 de octubre de 2026):** se conservan los tokens en memoria y se envía Bearer a LiquidAR. Existe restauración al recargar y renovación manual durante los 30 segundos posteriores al vencimiento del access token. Ver [Tokens para LiquidAR](tokens-liquidar.md). Las secciones históricas siguientes sobre descarte de tokens, ausencia de restauración y refresh pendiente no describen el estado actual. La referencia de Security corregida está en `E:/Proyectos/PayRoll`, mientras que la copia local de este workspace conserva código histórico.

Fecha del análisis: 25 de septiembre de 2026. Fuentes: código local de `../Zenthia.Security.Api/src`. La copia dentro del frontend tiene el mismo contenido C# comparado. No se modificó ninguna de ellas.

## Decisión explícita del usuario

El usuario aprobó la implementación y precisó: «Para esta app no vamos a usar `/me` sino implementar más adelante el endpoint en security. Por ahora que quede todo documentado».

Consecuencia: no hay consumo de `/api/users/me`, ni API de sesión inventada, ni restauración desde almacenamiento local. `AuthService.initialize()` finaliza la inicialización local como anónima y no realiza HTTP. El punto de incorporación del endpoint futuro queda localizado en ese método y en el tipo de estado de autenticación.

## Contrato usado

### Login

`POST /api/auth/login`, JSON:

```typescript
interface LoginRequest {
  userName: string;
  password: string;
  applicationId: number;
}
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // DateTime serializado por ASP.NET
  userId: number;
  userName: string;
  requiresPasswordChange: boolean;
  firstLogin: boolean;
  isSuperAdmin: boolean;
}
```

Security busca por email si el texto contiene `@` y `.`, o por nombre de usuario en otro caso. Comprueba contraseña y usuario activo. Ante rechazo devuelve ProblemDetails con 401, por ejemplo `Credenciales inválidas.` o `Usuario inactivo.`. `ApplicationId` proviene de configuración pública del frontend y necesita el valor real del ambiente; no es un campo editable del formulario.

Existe `LoginRequestValidator`, pero el endpoint de login no incorpora su filtro. Por eso el frontend exige campos no vacíos para UX y no impone una longitud mínima tomada de un validador que no se ejecuta. La contraseña no se recorta ni se transforma.

Fuentes: `Application/Auth/DTOs/AuthDTOs.cs`, `Application/Auth/Commands/AuthService.cs`, `Api/Endpoints/Auth/AuthEndpoints.cs`, `Api/Filters/Validators.cs`.

### Tokens y cookies

El login devuelve tokens en JSON **y** establece cookies. El frontend usa exclusivamente el mecanismo de cookies y proyecta la respuesta mediante Zod para descartar los tokens antes de guardar usuario/estado.

| Cookie          | Atributos observados                                              |
| --------------- | ----------------------------------------------------------------- |
| `access_token`  | HttpOnly, Secure, SameSite=None, Path=/, Expires a 15 minutos     |
| `refresh_token` | HttpOnly, Secure, SameSite=None, Path=/api/auth, Expires a 7 días |

`OnMessageReceived` extrae `access_token` de la cookie para el middleware JWT. El cliente Axios configura `withCredentials: true`, no lee cookies y no construye Authorization. No hay localStorage, sessionStorage, IndexedDB, JWT decode, cookies nuevas ni cache propio de credenciales.

Las vidas de JWT proceden de `JwtOptions.AccessTokenMinutes` y `RefreshTokenDays`, con valores por defecto 15 y 7. Las cookies tienen duraciones fijas separadas: un cambio de configuración puede desalinearlas. El frontend utiliza `expiresAt` recibido para retirar el contexto local al vencer, también al volver al foco o visibilidad de la pestaña. Esta fecha es una ayuda de UX; la validación de Security sigue siendo la autoridad.

Claims de acceso: `uid`, `uguid`, `tid`, `aid`, `super`, `roles`, `perms`, `jti`, además de emisor, audiencia y expiración. Los flags de cambio/primer inicio no están en esos claims. El frontend no decodifica JWT, no inventa roles y no asume permisos a partir de `isSuperAdmin`.

Fuentes: `Api/Endpoints/Auth/CookieOptionsHelper.cs`, `Infrastructure/DependencyInjection/InfrastructureExtensions.cs`, `Infrastructure/Security/JWT/User/JwtOptions.cs`, `JwtService.cs`.

### Primer inicio y cambio de clave

`requiresPasswordChange` es la condición de bloqueo. Si además `firstLogin` es verdadero, el destino es `/first-login`; en otro caso, `/change-password`.

`PUT /api/users/` requiere autenticación y tenant activo según la política del backend. Su request tiene `currentPassword`, `newPassword` y `confirmPassword`. El servicio verifica contraseña actual y coincidencia de las nuevas; actualiza el hash, desactiva `RequiresPasswordChange`, guarda y devuelve `UserDto`. No emite tokens nuevos ni invalida las cookies.

La nueva clave y su confirmación no se guardan globalmente. Los formularios eliminan sus valores al completar el intento. Tras un PUT exitoso se actualiza el flag local de cambio requerido y se navega a `/app`, con confirmación, conservando el vencimiento de la sesión.

El filtro `ValidationFilter<ChangePasswordRequest>` está conectado, pero no se encontró un validador registrado para ese DTO. No se trasladan las reglas de CreateUser ni las de la referencia visual: solo campos requeridos y coincidencia como UX.

**FirstLogin permanece verdadero después del cambio en el código actual.** No se falsifica ese flag en el frontend. No se utiliza aisladamente para bloquear: un usuario con `firstLogin=true` y `requiresPasswordChange=false` puede ingresar. Es una adaptación explícita al comportamiento encontrado; Security debe precisar y corregir la semántica en la tarea futura.

La UI de referencia incluye OTP, `otpSessionId` y `resetToken`; esos contratos no existen en Security analizado y no se implementan.

Fuentes: `Application/Users/Commands/UserService.cs`, `Application/Users/DTOs/UserDTOs.cs`, `Api/Endpoints/Users/UserEndpoints.cs`, `Api/Filters/ValidationFilter.cs`.

### Logout

`POST /api/auth/revoke`, autenticado: obtiene `uid`, revoca **todos** los refresh tokens del usuario y elimina ambas cookies con sus paths correspondientes. El frontend espera éxito, limpia usuario y UI y muestra login. El backend no implementa una lista de revocación de AccessTokens; revocar refresh no implica invalidar inmediatamente cada JWT ya emitido.

Si falla la red o devuelve 403/500, se mantiene el contexto local y se permite reintentar; no se afirma haber eliminado cookies HttpOnly. Si devuelve 401 o vence el contexto local, se pide login. En ese caso no se puede garantizar desde React la eliminación del refresh cookie restante. El endpoint futuro debe contemplar cierre de sesión aun con acceso expirado.

### Errores y concurrencia

ApiClient normaliza red, cancelación, autenticación, autorización, validación, 404, conflicto, exceso de intentos y servidor. Solo expone al usuario mensajes de negocio revisados; oculta detalles técnicos, traceIds y contenido arbitrario del servidor. No registra requests, contraseñas ni tokens.

Un 401 de login no se confunde con expiración de una sesión autenticada. Un 401 autenticado limpia el contexto únicamente si corresponde a su revisión actual. Las operaciones de AuthService se serializan: dos login/logout/cambios simultáneos no compiten por cookies. Respuestas atrasadas no vuelven a poblar un estado invalidado.

## Cache y renovación: diferencias encontradas

Hay registro de Redis/IDistributedCache y un `RedisCacheService`, pero no se encontró consumo de ICacheService en AuthService ni en la validación JWT de usuarios. La existencia de infraestructura de cache no demuestra que gestione sus tokens.

El servicio agrega refresh tokens a `RefreshTokenRepository`, que usa EF/BD. `AddAsync` agrega la entidad al contexto sin guardar. Login no invoca después `SaveChangesAsync`. Refresh guarda la revocación previa, pero tampoco guarda explícitamente el token nuevo agregado. No se encontró un commit al finalizar estas operaciones.

`POST /api/auth/refresh` obtiene la cookie `refresh_token` y construye `RefreshRequest("", refreshToken)`. El servicio intenta validar ese AccessToken vacío antes de validar el refresh, por lo que la renovación falla con el código observado. No se intenta arreglar enviando otro body o guardando tokens: el handler no usa ese body.

La intención del servicio es validar refresh, verificar registro vigente/no revocado, rotarlo y reconstruir roles/permisos desde BD. **No se habilita refresh automático ni se mockea como exitoso.**

Fuentes: `Application/Auth/Commands/AuthService.cs`, `Api/Endpoints/Auth/AuthEndpoints.cs`, `Infrastructure/Persistence/Repositories/Repositories.cs`, `Infrastructure/Persistence/UnitOfWork.cs`, `Infrastructure/Services/RedisCacheService.cs`.

## Actualización para Sindicatos

El código actual de Security ya expone GET /api/users/me con UserAuthDto (user y actor). Sindicatos utiliza actor para permisos después del login. Esta consulta no restaura sesión ni reemplaza los requisitos pendientes de expiración y cambio obligatorio descritos abajo. Ver [Sindicatos](sindicatos.md).

## Tarea futura en Security (sin implementar en esta entrega)

No hay método HTTP, ruta, DTO ni status codes definitivos para el nuevo endpoint de sesión. Los siguientes son requisitos a acordar, no un contrato existente:

1. Verificar sesión del navegador mediante el mecanismo real de Security y devolver contexto de usuario y aplicación.
2. Informar de forma autoritativa si el usuario debe cambiar contraseña y cómo interpretar primer ingreso, también después de recargar o abrir otra pestaña.
3. Definir estado no autenticado, expiración y tenant/aplicación no habilitados, distinguiéndolos de errores temporales.
4. Definir expiración y renovación coherentes con cookies, persistencia y cache real. Corregir el AccessToken vacío y el guardado de refresh tokens.
5. Corregir/documentar el ciclo de vida de FirstLogin y su relación con RequiresPasswordChange.
6. Definir cierre de sesión con acceso vencido y alcance de revocación por sesión/usuario.
7. Validar restricciones de cambio obligatorio también en backend. El guard de React no reemplaza autorización de API.
8. Definir orígenes, CSRF y proxy para autenticación con cookies. El CORS de `Program.cs` está comentado; esta app usa `/api` en el mismo origen HTTPS.
9. Si se requiere usar Redis para tokens, especificar qué datos almacena, cómo valida/invalida y su relación con BD. No trasladar esa responsabilidad al navegador.

Después de implementar y aprobar ese contrato, conectar `AuthService.initialize()` con el endpoint definitivo, agregar estados de restauración/red recuperable, integrar renovación en ApiClient y ampliar los tests para demostrar restauración y bloqueo tras recarga. Hasta entonces no se habilita `/app` solo porque existan cookies.

## Pendientes de integración

- ApplicationId real para LiquidAR y origen definitivo de Security/gateway.
- Certificado HTTPS confiable y routing same-origin del ambiente.
- Usuarios de prueba normal y con clave temporal, y tenant activo.
- Verificar login/cookies/PUT/revoke contra la API ejecutándose. Los tests locales no prueban BD, Redis, TLS ni efectos reales de Set-Cookie.
- No se modificaron Security, base de datos, backend de LiquidAR ni Legacy; tampoco se crearon commits.

## Actualización vigente: restauración por refresh

La restauración al recargar ya está conectada al POST /api/auth/refresh corregido. La copia de Security en E:/Proyectos/PayRoll es la referencia del contrato. Esto reemplaza las conclusiones históricas de este documento sobre ausencia de restauración. Ver el comportamiento, almacenamiento exclusivo de contexto de interfaz y limitaciones de flags en [Tokens para LiquidAR](tokens-liquidar.md#restauración-al-recargar-28-de-septiembre-de-2026).

# Mensajes de rechazo del login

El login muestra los motivos conocidos de Security para credenciales, usuario,
rol por aplicación, habilitación, licencia, facturación y fecha futura de inicio.
El mensaje de inicio conserva la fecha y las 00:00 de Argentina devueltas por Security.
El parser se limita al 401 de `/auth/login`, con mensajes explícitos y un patrón
cerrado para la fecha; respuestas desconocidas o errores internos mantienen el
mensaje genérico. No cambia la autorización ni la renovación de sesión.
