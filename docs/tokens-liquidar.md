# Tokens para LiquidAR sin BFF

Por solicitud explícita del usuario, el login conserva accessToken y refreshToken devueltos por Security en memoria privada de la pestaña. Esto reemplaza la decisión anterior de descartar ambos tokens. No se persisten en localStorage/sessionStorage ni se incluyen en el estado de UI, logs o archivos.

AuthService valida ambos tokens y expiresAt antes de aceptar la sesión. ApiClient de LiquidAR obtiene el access token en cada solicitud autenticada y envía Authorization: Bearer. No envía refreshToken ni cookies al microservicio. El cliente de Security conserva withCredentials y no adjunta Bearer.

Logout exitoso, cierre por agotamiento del plazo de recuperación y rechazo definitivo de autenticación eliminan los tokens. Un access token vencido nunca se envía a LiquidAR. Una respuesta de login atrasada no revive una sesión invalidada. El cambio de contraseña conserva los tokens existentes, según el contrato actual. Si logout falla, la sesión permanece para permitir reintentar.

Al recargar se restaura la sesión mediante el refresh de Security según la actualización siguiente. Durante una sesión abierta la renovación es manual, dentro de los 30 segundos posteriores al vencimiento del access token, según la sección vigente al final. Los tokens no se persisten en el navegador y el refresh token nunca se envía a LiquidAR.

VITE_SECURITY_BASE_URL y VITE_LIQUIDAR_BASE_URL siguen siendo independientes. LiquidAR debe admitir el origen del frontend y el header Authorization en CORS y validar los JWT emitidos por Security (issuer, audience, firma y contexto). Ya no se requiere un gateway que convierta cookie a Bearer para estas llamadas.

## Restauración al recargar (28 de septiembre de 2026)

Esta actualización reemplaza la limitación anterior de pérdida de sesión al recargar. AuthService.initialize consume POST /auth/refresh usando la cookie HttpOnly (withCredentials), valida TokenResult y recupera accessToken/refreshToken solo en memoria. Usa accessTokenExpiry como nuevo vencimiento. Después consulta GET /users/me para comprobar usuario y aplicación antes de habilitar las rutas y el Bearer de LiquidAR.

sessionStorage conserva exclusivamente el contexto de interfaz validado del login: identidad, vencimiento e indicadores de primer ingreso/cambio obligatorio. No contiene contraseñas ni tokens ni permisos. Ese contexto por sí solo nunca habilita acceso. Logout, expiración y 401 lo eliminan. El cambio de contraseña actualiza el indicador guardado. Sin contexto válido (incluido almacenamiento bloqueado), se solicita login.

Limitación del contrato: TokenResult no incluye RequiresPasswordChange ni FirstLogin; se conservan los últimos indicadores recibidos del login de esa pestaña. La autorización efectiva sigue perteneciendo al backend; cambios externos de estos indicadores requieren un contrato de sesión que los informe. Se comprueba la identidad con /users/me para no reutilizar contexto de otra cuenta/aplicación.

Durante la restauración se bloquea la navegación protegida y se deduplican llamadas concurrentes. Un 401 solicita login; errores temporales o respuestas incompatibles muestran reintento sin borrar contexto. Respuestas atrasadas no reactivan sesiones invalidadas. El cierre inmediato original durante una sesión abierta fue reemplazado por el plazo de recuperación de la sección siguiente. No se agrega renovación periódica.

## Retomar sesión después del vencimiento (20 de octubre de 2026)

Por decisión del usuario, el diálogo se muestra al vencer el access token. El plazo para pulsar **Retomar sesión** y completar la renovación termina exactamente 30 segundos después de ese vencimiento. La duración nueva procede de `accessTokenExpiry` de Security; no es una extensión de 30 segundos del JWT.

`SessionLifecycle` controla el tiempo aunque no haya interacción. Recalcula con `Date.now()` al recuperar foco o visibilidad: si se vuelve 10 segundos después del vencimiento, quedan 20; a partir de los 30 segundos se solicita login. Los navegadores pueden demorar los temporizadores en segundo plano; la comprobación al volver impide reiniciar el plazo. No es una notificación del sistema operativo.

Durante el aviso se conservan los componentes y borradores, con un Modal que bloquea la interacción de fondo. Escape y el backdrop no lo descartan. Los clientes HTTP bloquean solicitudes protegidas con acceso vencido antes de enviarlas. Un 401 durante ese plazo no destruye el contexto recuperable; un rechazo anterior al vencimiento mantiene el cierre inmediato habitual. Esto solo administra UX: LiquidAR sigue validando JWT y permisos en backend.

`AuthService.resume()` consume `POST /api/auth/refresh` sin body ni Bearer, usando la cookie HttpOnly existente. Valida `TokenResult`, consulta `GET /api/users/me` con las cookies renovadas y verifica usuario y aplicación antes de actualizar tokens privados y contexto. Conserva los últimos flags de cambio obligatorio de contraseña y primer ingreso, con la limitación de contrato ya documentada. No agrega claims, permisos ni endpoints.

La actualización de la misma sesión conserva `revision`, para no remontar rutas, cache y formularios. El vencimiento identifica la generación de credenciales en los clientes HTTP: respuestas de credenciales anteriores se descartan y un 401 atrasado no cierra la sesión retomada. Los permisos se vuelven a consultar sin desmontar por un error temporal de autenticación; las consultas activas fallidas pueden reintentarse, pero las escrituras nunca se reenvían automáticamente.

Un error temporal permite reintentar dentro del mismo plazo. Un 401 del refresh o de la identidad renovada, una identidad diferente o el agotamiento del plazo limpia la sesión local. Ninguna respuesta tardía la reactiva. La expiración local no invoca revoke ni garantiza borrar cookies HttpOnly: se mantiene la limitación existente del cierre con acceso expirado. La restauración al recargar sigue el flujo previamente documentado y no representa este diálogo de una sesión abierta.

Las operaciones de autenticación se serializan por pestaña; donde existe Web Locks también se serializan entre pestañas del mismo origen mediante `liquidar-security-session`, sin guardar credenciales ni señales en almacenamiento. En navegadores sin Web Locks se mantiene la serialización por pestaña; una rotación concurrente rechazada se trata según la respuesta de Security. No se coordinan orígenes diferentes.

No se modifica Security, LiquidAR backend ni legacy. La copia local de Security en este workspace contiene código histórico; la referencia del contrato sigue siendo `E:/Proyectos/PayRoll/Zenthia.Security.Api`. **No determinado:** versión desplegada en el ambiente real. Las pruebas con contrato simulado no verifican TLS, cookies, persistencia ni rotación reales de ese despliegue.

Contrato de referencia: E:/Proyectos/PayRoll/Zenthia.Security.Api/src/Api/Endpoints/Auth/AuthEndpoints.cs y Application/Auth/DTOs/AuthDTOs.cs. No se modificó Security ni el legacy. Las pruebas de refresh usan respuestas simuladas; queda pendiente la comprobación integrada con cookies/TLS del ambiente real.

### Validación de la entrega

Actualización 2026-10-23: la regresión `sessionTokens.test.ts` recorre login,
vencimiento completo, limpieza, nuevo login y consulta de capacidades. Comprueba
que sale el access token nuevo y que un 401 demorado de la sesión previa no
cierra la nueva. Las 45 pruebas pertinentes de tokens, recuperación, ApiClient
y ciclo de expiración aprobaron. No se cambió el flujo de autenticación ni se
decodifican JWT para autorizar desde React.

La API incorpora diagnóstico seguro de rechazos por evento 40101, sin incluir
credenciales ni valores de claims. El mensaje `Security authentication rejected.
Reason=... TraceId=...` debe obtenerse de la consola del servidor con el binario
actualizado, no del JSON genérico de Network. No se confirmó todavía la causa
del incidente real; no se amplió ClockSkew ni se omitieron validaciones como
solución supuesta.

- `npm.cmd run build`: correcto, incluye TypeScript. Vite informa un chunk principal mayor de 500 kB; no impide generar el build.
- Prettier sobre los archivos modificados: correcto.
- `npm.cmd test -- src/features/auth src/app/AppRoutes.test.tsx src/app/SessionLifecycle.test.tsx src/services/http/ApiClient.test.ts --maxWorkers=2`: 91 pruebas correctas.
- Suite completa con `--maxWorkers=2`: 300 pruebas correctas y 8 fallos. Dos fueron timeouts de `FormulaOrderDialog.test.tsx`; la repetición aislada de ese archivo pasó sus 6 pruebas. Los otros 6 corresponden a `config.test.ts`, por expectativas que no coinciden con el fallback de ApplicationId y la validación de URL actuales; esa configuración no se modificó en esta tarea.
- Playwright: aviso sin interacción, conservación del formulario, Escape, cuenta regresiva, retorno de suspensión, errores de renovación y coordinación entre dos pestañas verificados en escritorio, tablet y móvil. Axe sin violaciones en el diálogo y capturas revisadas en los tres tamaños. Estas pruebas simulan Security y no acreditan la integración contra su despliegue real.

## Evaluación del tiempo de sesión — 28 de octubre de 2026

### Diagnóstico verificado

El aviso actual no mide inactividad de teclado/mouse. Se muestra al vencer el access token, conserva 30 segundos para completar una renovación manual y después limpia el contexto local. No hay renovación periódica por actividad ni plazo de inactividad real definido. La duración nueva depende de Security.

| Capa | Comportamiento observado | Consecuencia |
| --- | --- | --- |
| Frontend | sessionTokens, sessionExpiry, SessionLifecycle y AuthService comparan expiresAt/accessTokenExpiry con Date.now(). | Una PC adelantada puede rechazar inmediatamente un login/refresh válido; atrasarla puede prolongar indebidamente la cuenta local. Un salto de hora mientras se usa la aplicación altera el resultado. |
| Security (referencia vigente E:/Proyectos/PayRoll/Zenthia.Security.Api) | JwtService genera vencimientos con DateTime.UtcNow y valida vigencia con ClockSkew=0. LoginResponse/TokenResult entregan fechas absolutas; no entregan duración restante ni hora explícita de respuesta. | El servidor es autoridad. UTC evita confusiones de zona horaria, pero no corrige un reloj del host equivocado. |
| LiquidAR.Api | AuthenticationExtensions conserva ValidateLifetime=true, RequireExpirationTime=true y firma/emisor/audiencia. ClockSkewSeconds tiene default 2, configurable externamente. | Una diferencia real entre los relojes de Security y LiquidAR puede causar 401 aunque la PC esté bien. No se inspeccionaron valores secretos ni la sincronización efectiva de esos hosts. |
| Cookies de Security | CookieOptionsHelper usa Expires absoluto con 15 minutos/7 días fijos, separados de JwtOptions configurables. | Las cookies pueden desalinearse del JWT si cambia su duración. Se recomienda duración relativa coherente con el token realmente emitido. |

Fuentes leídas: frontend src/features/auth/services/{authService,sessionTokens,sessionExpiry}.ts y src/app/SessionLifecycle.tsx; LiquidAR.Net10/src/LiquidAR.Api/Configuration/{AuthenticationOptions,AuthenticationExtensions}.cs; Security vigente src/Infrastructure/Security/JWT/User/JwtService.cs, src/Application/Auth/DTOs/AuthDTOs.cs y src/Api/Endpoints/Auth/{AuthEndpoints,CookieOptionsHelper}.cs. La copia de Security en este workspace es histórica; se verificaron también los archivos de la referencia vigente. La auditoría corresponde al código, no certifica configuración ni comportamiento del gateway desplegado.

### Propuesta recomendada para corregir el reloj (pendiente de implementación)

Guardar cuándo llegó el token es parte de la solución, pero usar Date.now() para ese registro y para restarlo más tarde sigue siendo vulnerable a cambios de hora. Tampoco permite determinar cuánto falta a partir de una fecha absoluta del servidor cuando la PC ya estaba desajustada al iniciar.

1. Security debe informar la **duración restante del access token al generar la respuesta** de login y refresh, calculada con su propio reloj. Mantener las fechas actuales para compatibilidad. El nombre/formato de este dato adicional está **No determinado**: es una ampliación propuesta del contrato de Security, no un campo existente ni un nuevo claim.
2. El frontend captura performance.now() al iniciar la petición y al recibir la respuesta y construye una referencia privada en memoria: instante monotónico de recepción + duración restante. Descontar un margen conservador de transporte; el RTT completo es una cota conservadora que puede acortar un poco la UX, nunca justificar más vigencia. No iniciar nuevamente el reloj después de consultar /users/me: ese tiempo también consume vida del token.
3. Un único módulo de tiempo debe proporcionar el tiempo restante a todos los consumidores (login, restauración, renovación, entrega de Bearer, bloqueo HTTP y diálogo). No basta con cambiar SessionLifecycle. Las comprobaciones de revisión/identidad y respuestas tardías se mantienen.
4. El contador se calcula por diferencia de tiempos monotónicos, no restando uno por cada setInterval. Así los temporizadores demorados no reinician el plazo. Un cambio manual de fecha o zona horaria no altera esa referencia. No persistir performance.now() para reutilizarlo tras una recarga: tiene un origen nuevo; la restauración exige el refresh/identidad existentes y crea otra referencia con su respuesta.
5. Al regresar de suspensión/hibernación, revalidar con el servidor antes de permitir operaciones protegidas si no se puede asegurar la continuidad del reloj. performance.now() tiene diferencias entre plataformas al suspender. No usar Date.now() como sustituto ni renovar automáticamente solo por recuperar foco, porque eso puede extender una sesión desatendida. Con un 401 definitivo se respeta el rechazo del servidor; sin conexión no se inventa una validación exitosa.
6. Security y LiquidAR conservan la validación UTC del JWT. Sincronizar los hosts con NTP/servicio de hora, supervisar la desviación y revisar una tolerancia pequeña y explícita si fuera necesaria. No desactivar ValidateLifetime, no aceptar la hora enviada por la PC como autoridad y no aumentar ClockSkew a horas para ocultar el problema. Un reloj monotónico solo no sustituye la hora UTC compartida entre emisor y consumidores.
7. En Security, alinear las cookies con el vencimiento efectivo emitido e incorporar Max-Age relativo, conservando HttpOnly/Secure/SameSite/Path. No modificar esos atributos ni crear otro almacenamiento de credenciales en React. Los cambios en cookies y contrato requieren implementación y pruebas en el servicio de Security vigente.

Ejemplo: el servidor entrega 900 segundos restantes. El navegador registra recepción monotónica 12000 ms; a los 312000 ms restan aproximadamente 600 segundos menos el margen de transporte, aunque el usuario adelante seis horas el reloj de Windows. La autorización efectiva sigue perteneciendo al backend.

Como transición sin ampliar el body, se puede evaluar la cabecera HTTP Date de la respuesta de Security. Es una referencia estándar, pero debe verificarse que represente al emisor y no a un proxy con otro reloj, que no sea una respuesta cacheada y que CORS permita leerla si corresponde. Tiene precisión de segundos y necesita un margen. Su disponibilidad y procedencia a través del gateway desplegado están **No determinadas**. No corresponde activar una caída silenciosa a Date.now() ni decodificar JWT como autoridad de autorización. Por esas condiciones se prefiere una duración explícita en el contrato.

Para **inactividad real**, primero definir plazo, actividad relevante y alcance por pestaña/sesión. Una implementación solo visual no impide reutilizar credenciales en otra pestaña. Si el requisito es de seguridad debe estar respaldado por una sesión y control de última actividad en Security; polling, refresh automático y simples lecturas en segundo plano no deben mantenerla viva sin una decisión expresa. Un contador monotónico sirve dentro de un proceso; no se debe persistir ni compartir entre procesos/hosts como si fuera una fecha UTC. No se redefine ese contrato en LiquidAR.

### Diálogo implementado en esta entrega

Se conserva el momento del aviso y la ventana de 30 segundos; no se cambia silenciosamente la política anterior para mostrarlo antes de expirar. Por eso el título dice **Tu sesión está por cerrarse** y no afirma que el JWT todavía sea válido. El diseño sigue la imagen aportada: panel blanco redondeado, cronómetro grande, texto centrado y acciones juntas. El naranja se ajusta para mantener contraste legible con texto blanco.

**Extender la sesión** usa el refresh existente, evita doble envío y conserva el estado y los borradores al completar la renovación. **Cerrar sesión** ejecuta inmediatamente el mismo expireSession del final de la cuenta: limpia tokens privados, contexto y estado de interfaz, sin esperar los 30 segundos. Sigue disponible durante una renovación pendiente; la revisión de sesión existente impide reactivarla mediante una respuesta tardía. Escape y backdrop no descartan el aviso.

Este cierre inmediato local mantiene la semántica del vencimiento anterior: no revoca todas las sesiones ni elimina por sí mismo cookies HttpOnly. El endpoint revoke actual exige acceso válido, por lo que invocarlo con el token ya vencido no ofrece esa garantía. Cambiar logout/revocación requiere una decisión y un contrato específico de Security; no se inventó un endpoint para ello.

Se reutilizan Modal y Button; Modal admite una clase de estilo opcional para este diseño, sin cambiar el comportamiento de los demás diálogos. El color y distribución del aviso responden a la referencia específica del usuario, en lugar del encabezado y pie compactos de formularios CRUD.

### Fuentes técnicas

- Reloj monotónico independiente de cambios del reloj de sistema: [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/).
- Diferencias de suspensión entre plataformas: [Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now).
- Vigencia JWT y tolerancia pequeña al desfase: [RFC 7519, sección 4.1.4](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1.4).
- Significado de Date y recomendación de sincronización: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1).
- Max-Age relativo y precedencia sobre Expires: [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.2).

No se modificó Security ni el backend de negocio. El problema del reloj queda diagnosticado y con propuesta de implementación; no se afirma que haya quedado corregido con el cambio visual.

### Validación de esta entrega

TypeScript y build de producción correctos. 44 pruebas focalizadas aprobadas (SessionLifecycle, renovación y Modal), incluidas cierre inmediato y cierre durante refresh pendiente. Seis pruebas Playwright aprobadas: nuevo aviso y flujo de renovación conservando un formulario abierto en escritorio, tablet y móvil. Las pruebas ejecutan auditoría axe de accesibilidad; se revisaron visualmente las capturas de los tres tamaños contra la imagen solicitada. Prettier correcto para todos los archivos de código modificados. No se ejecutaron pruebas del backend porque no se modificó su código; su parte de esta entrega es la evaluación documentada. No se cambió la duración actual ni se implementó todavía la propuesta de reloj monotónico.

## Implementación del reloj relativo — 28 de octubre de 2026

Por confirmación del usuario se conserva el vencimiento del access token y la ventana de 30 segundos posteriores para completar la renovación. No se agrega un plazo de inactividad ni renovación automática por teclado/mouse. Esta sección reemplaza el estado de propuesta pendiente de la evaluación anterior.

### Contrato implementado en Security

La referencia vigente modificada es `E:/Proyectos/PayRoll/Zenthia.Security.Api`, no la copia histórica de Security de este workspace. Las respuestas de `POST /api/auth/login` y `POST /api/auth/refresh` agregan `accessTokenRemainingMilliseconds`, entero no negativo. Los campos anteriores de tokens y fechas se conservan. Es metadata de respuesta HTTP, no un claim ni un mecanismo nuevo de autenticación.

El endpoint calcula la duración al preparar la respuesta, usando únicamente UTC del emisor y el vencimiento real del JWT redondeado a segundos. No anuncia como vida útil las fracciones de segundo que el JWT no contiene. Login y refresh se envían con Cache-Control: no-store. Se conserva la validación de firma, emisor, audiencia y vigencia; LiquidAR.Api no requiere modificar su contrato JWT ni sus permisos.

Las cookies existentes agregan Max-Age relativo, manteniendo los mismos 15 minutos/7 días de CookieOptionsHelper y sus demás atributos. No se modificaron los plazos configurados de JWT. La separación histórica entre constantes de cookies y JwtOptions continúa: si esos valores configurables cambian, su alineación debe resolverse en Security. No se afirma haber corregido esa configuración ajena a este cambio.

### Reloj del frontend

`sessionClock.ts` crea una referencia privada por pestaña con performance.now(). Se descuenta conservadoramente el RTT completo: deadline = inicioMonotónicoDePetición + duraciónRestanteRecibida. La referencia se crea antes de /users/me y se conserva al confirmar la identidad, para no regalar el tiempo que consumió esa consulta. No se usa Date.now() para decidir si una sesión sigue vigente.

La misma referencia se utiliza en AuthService (login/restauración/renovación y operaciones protegidas), entrega de Bearer, bloqueo de HTTP y SessionLifecycle. El agotamiento del token no elimina la referencia de tiempo durante los 30 segundos recuperables. Cerrar sesión sí la elimina, junto con los tokens y el contexto. La fecha UTC recibida queda como metadata, sin compararla con el calendario de la PC.

Cada entrega de credenciales cambia una generación interna, incluso cuando la fecha absoluta del vencimiento coincide. Los clientes HTTP descartan respuestas de generaciones anteriores sin repetir escrituras; renovar la misma sesión conserva la revisión de UI para mantener formularios y borradores. No se guardan deadlines monotónicos ni tokens en sessionStorage. Una recarga restaura por el refresh y verificación de identidad existentes, obteniendo otra duración del emisor.

Adelantar o atrasar el reloj del cliente, incluso si ya estaba equivocado al hacer login, no cambia la duración. Las validaciones UTC de los servidores siguen siendo obligatorias y sus relojes deben estar sincronizados. En sistemas donde performance.now() se detiene al suspender el SO, no se promete una medición de suspensión portable: el backend continúa rechazando JWT vencidos y no se realiza una renovación silenciosa al recuperar foco. El entorno Windows del usuario y los cambios manuales de fecha se cubren mediante pruebas de navegador; no se certifica una hibernación real de todos los sistemas operativos.

### Orden de actualización

1. Compilar/publicar la versión de Security vigente que incorpora el campo y reiniciar ese servicio en su entorno habitual.
2. Comprobar que login y refresh devuelven `accessTokenRemainingMilliseconds`.
3. Publicar/reiniciar el frontend actualizado y volver a iniciar sesión.

El frontend exige el nuevo campo y rechaza una respuesta antigua/incompatible. No cae silenciosamente al reloj del cliente. Por ello Security debe actualizarse primero. La copia histórica `C:/Proyectos/Codex/Zenthia.Security.Api` no se modifica ni sustituye al servicio vigente. No se publicaron ni reiniciaron servicios remotos desde esta tarea; no se usaron credenciales reales para verificar login.

### Pruebas

Security compila correctamente. El ejecutable de comprobaciones `tests/SessionClockChecks` de Security verifica duración en precisión JWT, expiración, zona horaria, UTC requerido, serialización del nuevo campo en ambos DTO y contrato de cookies, sin conexiones reales. Se ejecuta con `dotnet run --project tests/SessionClockChecks/SessionClockChecks.csproj`. El proyecto de API excluye las fuentes de tests de su compilación de producción. No se agregan paquetes.

La compilación informa advertencias de paquetes ya referenciados por Security: NU1603 para la resolución de System.IdentityModel.Tokens.Jwt y NU1903 para Microsoft.OpenApi 2.0.0. No se cambiaron versiones de paquetes ni se mezcló su actualización con este cambio.

Validación final del reloj relativo: 79 pruebas de servicios/ciclo de sesión/rutas y 26 de permisos/HTTP aprobadas (105 en total); seis pruebas Playwright aprobadas en escritorio, tablet y móvil, incluidas una PC inicialmente en 2040, cambio de fecha a 1990, extensión con borrador abierto y cierre inmediato. Se comprobó también que la latencia y /users/me no reinician la duración, que se conserva exactamente la ventana monotónica de 30 segundos y que falta de metadata falla como incompatibilidad de contrato. Build de producción y Prettier correctos. Security compila sin errores y sus nueve comprobaciones de duración, serialización y cookies pasan. No se realizaron commits, cambios de base de datos ni despliegue de servicios remotos.

## Compatibilidad con Security anterior — 28 de octubre de 2026

Corrección posterior al error de login «No pudimos validar la respuesta del servicio». La versión anterior del frontend exigía accessTokenRemainingMilliseconds antes de que necesariamente estuviera publicada la versión nueva de Security. Esta sección reemplaza esa obligación de despliegue como requisito del login cuando existe una referencia HTTP válida del servidor.

El frontend prefiere la duración explícita. Si el campo está ausente (no si tiene un valor inválido), usa expiresAt/accessTokenExpiry junto con la cabecera HTTP Date de esa misma respuesta. Ambas fechas proceden del servidor: no se compara ninguna con Date.now(). Se redondea el vencimiento a segundos del JWT y se descuenta un segundo adicional por precisión de Date, además del RTT conservador. Después continúa el mismo reloj monotónico privado y la misma ventana de 30 segundos. Una duración explícita cero significa expiración y no se sustituye por Date.

ApiClient permite solicitar únicamente esa cabecera pública mediante onServerDate; no expone cookies, tokens ni todo el conjunto de headers. No entrega la referencia cuando Age indica una respuesta envejecida o tiene un valor inválido. Una Date faltante, mal formada o no canónica se rechaza con un mensaje específico indicando que Security o el gateway deben informar una referencia válida; nunca hay fallback al reloj local.

Se comprobó sin credenciales que el gateway configurado (https://gateway.zenthia.ar/api/auth/login) responde OPTIONS con 405 y una Date válida. No se realizó un login real ni se imprimieron respuestas con tokens. La Date representa el reloj de la infraestructura que sirve la respuesta y puede proceder del proxy; ese servidor debe mantener UTC sincronizado, igual que Security y LiquidAR. No es evidencia de autenticación ni cambia la validación JWT del backend. La duración explícita de Security sigue siendo el contrato preferido y evita esa dependencia del reloj del gateway.

El ambiente actual utiliza /api por el proxy del frontend, por lo que Date es accesible como cabecera del mismo origen. Un despliegue cross-origin debe exponer Date y Age por CORS si necesita esta compatibilidad. No se cambiaron permisos CORS de Security ni endpoints ni almacenamiento de credenciales.

La compatibilidad se aplica en login, restauración y renovación. Se agregaron pruebas para relojes en 1990/2040, preferencia por la duración explícita, rechazo de fechas inválidas y Age>0, y respuesta antigua con la cabecera Date. No es necesario actualizar Security antes de probar el frontend corregido si la respuesta incluye una referencia Date válida; actualizar Security sigue siendo recomendado para usar la duración explícita.

Validación de compatibilidad: TypeScript, build de producción y Prettier correctos; 83 pruebas focalizadas aprobadas y nueve pruebas Playwright aprobadas (formatos anterior/actual más renovación con borrador, en escritorio/tablet/móvil). Se verificaron relojes del cliente adelantados/atrasados sin usar credenciales reales. No se cambió el backend ni se relajó la validación JWT para resolver esta incompatibilidad.

