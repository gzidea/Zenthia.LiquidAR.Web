# Zenthia.LiquidAR.Web

## Base compartida del ecosistema

La UI, el tema, Brand y ShellFrame provienen de paquetes versionados de
`Zenthia.Frontend.Shared`. Los imports locales de `components/ui` conservan compatibilidad
y reexportan `@zenthia/ui`; los menús, permisos, autenticación y contextos de negocio
siguen siendo propios de LiquidAR. No hay dependencia de ejecución con Administrar.

Las referencias file a `.tgz` y package-lock.json fijan la versión de cada paquete.
Para npm local, conservar `Zenthia.Frontend.Shared/artifacts` al instalar o compilar.
El build Docker incluye sus propias copias en `deploy/packages`, sin necesitar el
checkout de Shared. Ver [paquetes para la imagen](deploy/packages/README.md).
Un despliegue de `dist/` no necesita esos paquetes ni otra aplicación en funcionamiento.
Ver [paquetes y actualización](../Zenthia.Frontend.Shared/README.md).

**Autenticación actual de LiquidAR:** los tokens se conservan en memoria de la pestaña y el access token se envía como Bearer exclusivamente al microservicio. Security mantiene cookies. La sesión se pierde al recargar. Esta decisión solicitada por el usuario reemplaza las referencias históricas de esta página al descarte de tokens y al gateway de autenticación. Ver [Tokens para LiquidAR](docs/tokens-liquidar.md).

Frontend de LiquidAR: React + TypeScript + Vite. Etapa 1: acceso, primer ingreso, cambio de contraseña y shell de aplicación.

## Ejecutar

### URLs independientes de Security y LiquidAR

Configurar en `.env.local`:

```dotenv
VITE_SECURITY_BASE_URL=https://gateway.zenthia.ar/api
VITE_LIQUIDAR_BASE_URL=http://localhost:5100/api
```

El puerto 5100 es ilustrativo: reemplazarlo por el puerto real del microservicio en desarrollo. Ambas URLs incluyen el prefijo `/api`, sin agregar `/sindicatos`. Security utiliza la primera para login, perfil y cierre de sesión; Sindicatos utiliza la segunda. Ambas aceptan también rutas relativas y, si se omiten, conservan `/api`. Reiniciar Vite después de modificar el archivo; en producción estas variables se incorporan al build.

Para llamadas directas entre distintos orígenes, las APIs deben admitir el origen del frontend y credenciales mediante CORS. La separación de URLs no traslada la cookie de Security al host local ni transforma cookies en Bearer: el mecanismo de autenticación de LiquidAR debe estar resuelto por la infraestructura correspondiente. No se agregan tokens al navegador.

Requiere Node compatible con `engines` en `package.json` y npm. En Windows se puede usar `npm.cmd` si PowerShell bloquea `npm.ps1`.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
# Completar VITE_SECURITY_APPLICATION_ID con el ID real asignado por Security.
npm.cmd run dev
```

La aplicación abre en `http://localhost:5175`. Sin el ApplicationId real muestra un aviso y deshabilita el ingreso; no usa un ID por defecto. El nombre visible es **Zenthia.LiquidAR.Web**; el nombre técnico npm es `zenthia-liquidar-web`.

`SECURITY_PROXY_TARGET` apunta por defecto a `http://localhost:5103`, el puerto del perfil local de Security analizado. Confirmar ese valor en el entorno a utilizar. No se incluye ni se levanta Security con este proyecto.

Para autenticar con las cookies `Secure` de Security, utilizar HTTPS. Vite admite los paths de un certificado PEM local confiable con `DEV_HTTPS_CERT` y `DEV_HTTPS_KEY`. HTTP queda disponible para inspección visual; no se considera prueba de autenticación integrada. No se degradan las cookies ni se desactiva la validación TLS del proxy.

## Decisión de sesión en esta etapa

**No se consume `/api/users/me`.** Por decisión del usuario, el endpoint de sesión se implementará más adelante en Security. No hay ninguna llamada de restauración ni ruta ficticia para reemplazarlo.

- Login exitoso establece las cookies de Security; la aplicación conserva solamente los datos no sensibles de su respuesta en memoria.
- `requiresPasswordChange` bloquea `/app/*`. `firstLogin` selecciona la bienvenida dentro de ese bloqueo.
- `PUT /api/users/` exitoso permite continuar con la misma sesión, sin repetir login ni generar tokens.
- Recargar, cerrar o abrir otra pestaña pierde el contexto del frontend y vuelve a pedir login, aunque el navegador todavía tenga cookies de Security.
- Al vencer `expiresAt` o recibir 401 en una petición autenticada se limpia el contexto y se pide login. No hay refresh automático mientras el flujo de Security tenga los defectos documentados.
- Logout usa `POST /api/auth/revoke`. Un fallo de red no se presenta como cierre exitoso; las cookies HttpOnly solo las puede eliminar Security.

Detalle de contratos, limitaciones y trabajo pendiente: [Security y sesión](docs/security-session.md).

## Comandos de calidad

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run format:check
npm.cmd test
npm.cmd run test:coverage
npm.cmd run test:browser
```

`npm.cmd run format` aplica Prettier únicamente al frontend y su documentación; excluye los directorios de referencia existentes y `AGENTS.md`. Coverage genera HTML en `coverage/index.html` y LCOV. Los tests usan fixtures de contrato identificadas como tales; no necesitan credenciales ni conectan con Security real.

Los tests de navegador requieren Google Chrome instalado. Playwright inicia un servidor temporal en el puerto 5176, con un ApplicationId de fixture y todas las llamadas API interceptadas; no cambia `.env.local`. Verifica escritorio, tablet y móvil, y guarda capturas/reporte en `artifacts/`. La configuración real de desarrollo sigue usando el puerto 5175 y requiere el ID real de Security. Playwright y axe-core son dependencias de desarrollo para verificar flujos, responsive y accesibilidad.

## Arquitectura

```text
src/
  app/                    Router, ciclo de sesión y página inicial
  components/             Marca y controles reutilizables
  features/auth/
    components/           Tarjeta, pasos y cierre de sesión
    pages/                Login, bienvenida y cambio de clave
    schemas/              Validación UX y proyección de respuesta
    services/             AuthService y cliente configurado para Security
    stores/               Estado de autenticación en memoria
    types/                DTOs reales de Security y estado de UI
  layouts/                AuthLayout, Navbar, Sidebar y contenido
  lib/                    Variables públicas tipadas y validadas
  services/http/          ApiClient Axios y errores seguros
  stores/                 Sidebar/UI sin persistencia
  styles/                 Tokens y sistema visual responsive
  test/                   Setup y fixtures compartidas
```

Los formularios llaman a `AuthService`; los servicios a `ApiClient`. Únicamente el cliente HTTP depende de Axios. Zustand no funciona como cache de datos remotos ni almacena tokens. No se incorpora React Query porque esta etapa no lo necesita. El sidebar contiene solo Inicio, la página base ya implementada; no tiene permisos ni módulos inventados.

Rutas:

| Ruta               | Acceso                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| `/login`           | Público; una sesión en memoria redirige a su destino                                    |
| `/first-login`     | Sesión con cambio requerido y primer ingreso                                            |
| `/change-password` | Sesión vigente; cambio requerido o voluntario                                           |
| `/app/*`           | Sesión vigente sin cambio requerido; páginas desconocidas muestran 404 dentro del shell |

## Dependencias

Versiones exactas en `package.json` y árbol reproducible en `package-lock.json`.

| Grupo                                                              | Uso                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| React, React DOM, TypeScript, Vite y plugin React                  | Aplicación, tipado y build                                                           |
| React Router                                                       | Rutas y guards                                                                       |
| Zustand                                                            | Sesión y UI en memoria                                                               |
| Axios                                                              | Único transporte HTTP                                                                |
| React Hook Form, Zod, resolvers                                    | Formularios y validación                                                             |
| Fontsource Fraunces, IBM Plex Sans y Mono                          | Tipografías de referencia alojadas con la aplicación, sin solicitudes a Google Fonts |
| Vitest, coverage-v8, Testing Library, user-event, jest-dom y jsdom | Tests de comportamiento y cobertura                                                  |
| Prettier y tipos                                                   | Formato y comprobación estática                                                      |

El diseño adapta `liquidar-onboarding`: papel verde `#e8eee2`, tinta `#1c2620`, acento terracota `#b8402a`, tarjeta con borde punteado, radios pequeños, indicadores de pasos y sello de confirmación. No copia OTP, reglas de contraseña ni arquitectura de la referencia. Las fuentes se sirven localmente; el CSS contempla teclado, errores asociados a campos, avisos accesibles, movimiento reducido y navegación móvil.

## Despliegue

GitHub Actions construye la imagen, la publica en GHCR y, si se configuró el webhook,
solicita su actualización en Portainer. Se mantiene el flujo funcional actual de
LiquidAR: cookies con Security, tokens privados en memoria y Bearer hacia la API de
LiquidAR. Ver el contrato vigente en [Tokens para LiquidAR](docs/tokens-liquidar.md);
las secciones históricas de este README no reemplazan esas actualizaciones.

### Configuración preparada

| Elemento             | Valor                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Workflow             | `.github/workflows/deploy.yml`, push y ejecución manual sobre `main`     |
| Imagen               | `ghcr.io/<propietario>/<repositorio>:latest` y etiqueta con SHA completo |
| Puerto publicado     | `8090:80`, confirmado por el usuario                                     |
| Stack propuesto      | `zenthia-liquidar-web`, independiente del backend y de Administrar       |
| Servicio del Compose | `liquidar-web`                                                           |
| Red de producción    | `external_zenthia`, existente en el Swarm                                |
| Security/gateway     | `https://gateway.zenthia.ar`                                             |
| API de LiquidAR      | `https://liquidar-api.zenthia.ar`, confirmada por el usuario             |

**Repositorio GitHub, ApplicationId real de LiquidAR, webhook propio y hostname HTTPS
del frontend: No determinado.** No reutilizar por suposición el ApplicationId de
Administrar ni el hostname de la API como hostname del frontend.

El Dockerfile compila con Node 24 Alpine y sirve solamente `dist` con Nginx, fallback
de SPA y healthcheck `/health`. Incluye app-shell 0.1.1 y ui 0.1.2 sin cambiar
package.json, el lockfile o las fuentes compartidas. No adopta automáticamente las
versiones ni el cliente de Security de Administrar.

### Dos APIs en el mismo origen del frontend

En esta imagen se compilan estas bases públicas:

```env
VITE_SECURITY_BASE_URL=/api
VITE_LIQUIDAR_BASE_URL=/liquidar-api
```

Nginx genera su configuración con las variables del contenedor:

| Petición del navegador                                        | Destino                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `/api/auth/login`, `/api/auth/refresh`, `/api/users/me`, etc. | `SECURITY_API_ORIGIN` conservando la ruta `/api/*`       |
| `/liquidar-api/configuracion/sindicatos`, etc.                | `LIQUIDAR_API_ORIGIN/api/configuracion/sindicatos`, etc. |

`/liquidar-api` es exclusivamente un prefijo del proxy del frontend. La API conserva
sus endpoints `/api/*`; no se modifica el backend ni se presupone que el gateway
publique las rutas de negocio de LiquidAR.

La ruta de Security conserva cookies y excluye Authorization. La ruta de LiquidAR
conserva Bearer y encabezados de contexto, elimina Cookie y no acepta Set-Cookie desde
el backend de negocio. No hay conversión de cookie a token ni almacenamiento nuevo:
los tokens siguen bajo el cliente de LiquidAR existente. El filtrado de cookies en
Nginx también evita reenviarlas por tratarse ahora de solicitudes del mismo origen.
La autorización efectiva, permisos y tenant siguen a cargo de las APIs.

Se conserva la cabecera Date del upstream para la compatibilidad del reloj de sesión;
se valida TLS de upstreams HTTPS con las autoridades del sistema. El proxy de LiquidAR
admite 120 segundos de espera de respuesta, acorde con las operaciones largas del
cliente. No impone el límite adicional de subida de 1 MB de Nginx: el backend conserva
sus límites, incluido el máximo de 10 MB de la planilla de novedades. El proxy exterior
también debe permitir el tamaño y tiempo requeridos por esas operaciones.

Los orígenes se configuran sin `/api`, sin barra final ni credenciales. La URL entregada
`https://liquidar-api.zenthia.ar/` se normalizó quitando la barra final. Cambiar los
orígenes requiere recrear las tareas/contenedores; no reconstruir el JavaScript.
Cambiar el ApplicationId sí requiere reconstruir la imagen. No hay secretos en `VITE_*`.

### Paso a paso: generar la imagen en GitHub

1. Crear o utilizar el repositorio independiente de LiquidAR Web con rama `main`.
   Subir **el contenido de esta carpeta como raíz**, incluida `.github`, Dockerfile,
   `.dockerignore`, `.gitattributes`, package.json/lockfile, configuraciones Vite y
   TypeScript, `index.html`, `src`, los `.ts` de `e2e` y `deploy`. No subir `.env`,
   certificados, node_modules, dist ni artefactos de pruebas.
2. Confirmar que `deploy/packages` contiene `zenthia-app-shell-0.1.1.tgz` y
   `zenthia-ui-0.1.2.tgz`. Sin esas copias no se podrá completar `npm ci` en GitHub.
3. En **Settings → Secrets and variables → Actions → Variables**, crear la variable
   de **repositorio** `SECURITY_APPLICATION_ID` con el ID numérico real de LiquidAR
   registrado en Security. Es una variable, no un secreto; debe estar entre 1 y 2147483647. La construcción se detiene si falta o no es válida, sin depender del
   fallback histórico que existe en la configuración del frontend.
4. Para la primera publicación, dejar `PORTAINER_WEBHOOK_URL` sin configurar hasta
   crear el stack. Subir los cambios a `main` o ejecutar **Actions → Build and Push
   Docker Image → Run workflow**, seleccionando `main`.
5. Esperar que el job termine correctamente. Copiar la imagen exacta que muestra
   **Resolve image name** y guardar el SHA de la revisión publicada. GitHub genera
   `GITHUB_TOKEN` automáticamente; el workflow pide `contents: read` y `packages: write`.
   Sin webhook, la imagen se publica y el redeploy se omite con un aviso.

No se necesita configurar en GitHub las URLs del backend: las recibe Nginx desde
Portainer. Referencias: [publicación en GHCR](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
y [variables de Vite](https://vite.dev/guide/env-and-mode).

### Paso a paso: Portainer y Docker Swarm del VPS

1. Seleccionar en Portainer el **mismo entorno Swarm** donde están los otros servicios.
   Comprobar que `external_zenthia` existe como red overlay y que 8090 está libre.
   Reutilizar esa red; no reemplazarla ni crear una bridge con el mismo nombre.
2. Si la imagen GHCR es privada, agregar un registro personalizado `ghcr.io` en
   Portainer, con usuario GitHub autorizado y token classic con `read:packages`.
   Es una credencial del registro, distinta del token automático de Actions. Guardarla
   únicamente en Portainer y seleccionar ese registro al desplegar.
3. En **Stacks → Add stack**, usar el nombre **`zenthia-liquidar-web`**, elegir
   **Web editor** y pegar el contenido de [docker-compose.yml](docker-compose.yml).
4. Cargar estas variables del stack:

   | Variable              | Valor                                                                                 |
   | --------------------- | ------------------------------------------------------------------------------------- |
   | `LIQUIDAR_WEB_IMAGE`  | La referencia exacta `ghcr.io/<propietario>/<repositorio>:latest` mostrada por GitHub |
   | `SECURITY_API_ORIGIN` | `https://gateway.zenthia.ar`                                                          |
   | `LIQUIDAR_API_ORIGIN` | `https://liquidar-api.zenthia.ar`                                                     |

5. Pulsar **Deploy the stack** y comprobar una réplica activa del servicio
   **`zenthia-liquidar-web_liquidar-web`**. El Compose tiene una réplica y política de
   reinicio de Swarm; no usa `container_name`, que no es la identidad del servicio.
   El puerto público es 8090 y el interno es 80.
6. Si Portainer permite webhooks de stacks, crear uno propio para este stack y guardar
   su URL en GitHub, **Actions → Secrets**, como `PORTAINER_WEBHOOK_URL`.
   No reutilizar el webhook de Administrar, de la landing ni del backend. Debe ser
   accesible desde los runners mediante HTTPS válido.
7. Ejecutar de nuevo el workflow sobre `main` y comprobar **Trigger Portainer redeploy**.
   Un POST aceptado no garantiza que la actualización haya terminado: comprobar el
   estado y la imagen del servicio en Portainer.

La documentación actual de Portainer limita los webhooks de stacks a **Business
Edition** y entornos no Edge. Con Community, dejar el secreto sin configurar; GHCR
recibirá las imágenes y el stack se actualizará manualmente según la sección siguiente.
Ver [crear stacks](https://docs.portainer.io/user/docker/stacks/add),
[registros privados](https://docs.portainer.io/admin/registries/add/custom) y
[webhooks](https://docs.portainer.io/user/docker/stacks/webhooks).

### Nginx Proxy Manager y HTTPS

Configurar un Proxy Host para el hostname propio de LiquidAR Web. Si Nginx Proxy Manager
comparte `external_zenthia` con el servicio, usar:

| Campo                 | Valor                                   |
| --------------------- | --------------------------------------- |
| Domain Names          | El hostname confirmado del **frontend** |
| Scheme                | `http`                                  |
| Forward Hostname / IP | `zenthia-liquidar-web_liquidar-web`     |
| Forward Port          | `80`                                    |

Ese nombre corresponde al stack y servicio propuestos arriba. Si se eligió otro nombre
de stack, copiar el nombre completo que muestra Portainer. Ambos deben compartir la
misma red overlay. Como alternativa, si el proxy puede alcanzar el puerto publicado
del VPS, usar la IP del VPS y **8090**; no mezclar nombre interno con puerto público.

Apuntar el DNS del frontend al VPS, solicitar un certificado válido en **SSL** y activar
**Force SSL**. Entrar por `https://<hostname-del-frontend>`, sin `:8090`. El hostname
debe ser diferente del de Administrar para separar las cookies. No usar HTTP de la IP
como prueba de autenticación: Security utiliza cookies Secure. Los certificados de
Vite (`DEV_HTTPS_CERT` y `DEV_HTTPS_KEY`) no participan en el despliegue Docker.

Para conservar las subidas y operaciones largas, revisar también los límites del
Proxy Host exterior. En su configuración avanzada pueden delegarse los límites de
cuerpo en la API y acompañar el timeout del frontend con:

```nginx
client_max_body_size 0;
proxy_read_timeout 120s;
```

Estas directivas corresponden únicamente al Proxy Host de LiquidAR Web. El backend
sigue validando tamaños y reglas de negocio. No modificar por esta tarea los hosts
de Administrar o de las APIs. Referencia: [Nginx Proxy Manager](https://nginxproxymanager.com/guide/).

### Verificar, actualizar y volver a una versión anterior

En Portainer comprobar tarea activa, healthcheck correcto, ausencia de reinicios y
logs sin errores de DNS, orígenes o certificados. Por SSH en el manager del Swarm:

```bash
docker service ls --filter name=zenthia-liquidar-web_liquidar-web
docker service ps zenthia-liquidar-web_liquidar-web
docker service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' zenthia-liquidar-web_liquidar-web
curl -I http://127.0.0.1:8090/health
curl -I http://127.0.0.1:8090/login
```

`/health` debe devolver 204 y `/login`, 200. El healthcheck solo comprueba Nginx; luego
verificar HTTPS, login con una cuenta autorizada, restauración/renovación y una consulta
permitida de negocio. En Network, Security debe usar `/api/*` y LiquidAR
`/liquidar-api/*`. No se probaron cuentas reales durante la preparación.

- **Con webhook:** publicar cambios en `main`, esperar el workflow y comprobar en
  Portainer que la tarea usa la revisión publicada. Mantener la variable de imagen
  con `:latest` para este circuito.
- **Sin webhook:** después de la publicación, cambiar `LIQUIDAR_WEB_IMAGE` en el stack
  a `ghcr.io/<propietario>/<repositorio>:<sha-publicado>` y actualizar el stack. Una
  etiqueta nueva evita reutilizar la copia anterior de `latest`. Si se mantiene
  `latest`, indicar que Portainer vuelva a descargarla al actualizar, cuando ofrezca
  esa opción.
- **Cambio de Compose:** copiar el nuevo archivo versionado al editor del stack y
  actualizar. El webhook de un stack Web editor no sincroniza su YAML desde GitHub.
- **Rollback:** seleccionar una etiqueta SHA anterior ya publicada, actualizar la
  variable de imagen y redeplegar. Solo se revierte el frontend. Mientras quede
  fijado un SHA, el webhook seguirá usando esa versión; volver a `latest` para
  retomar las actualizaciones automáticas.

Si `SECURITY_APPLICATION_ID` aparece vacío en Actions, revisar **Variables** del
repositorio; el `.env` local y las variables de Portainer no completan ese valor.
Un 401 antes de iniciar sesión no acredita por sí solo un fallo del proxy. Un 502,
un error de certificado o una ruta de negocio que devuelve 404 requieren revisar
el upstream correspondiente, no enviar todas las rutas al gateway de Security.

### Docker local y configuración de entorno

`docker-compose.local.yml` construye la misma imagen y publica solo
`127.0.0.1:8090`. Usa `VITE_SECURITY_APPLICATION_ID` del entorno local y los dos
orígenes de API anteriores, que pueden reemplazarse por destinos de prueba accesibles
desde el contenedor. `localhost` dentro del contenedor identifica al contenedor.
El acceso HTTP local sirve para inspección; para probar autenticación con cookies
Secure se necesita un origen HTTPS también en ese entorno.

```powershell
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.local.yml up --build -d
```

Compose lee `.env` automáticamente. Si se utiliza `.env.local`, agregar
`--env-file .env.local` antes de `-f` en ambos comandos. Para ejecutar npm desde un
checkout independiente fuera de Docker, restaurar las dos copias de `deploy/packages`
en `../Zenthia.Frontend.Shared/artifacts` antes de `npm ci`.

`.env.example` contiene los nombres de variables y orígenes confirmados, pero la
imagen y el ApplicationId requieren los valores reales. El `.env` personal no se
modifica ni se envía a GitHub. Portainer utiliza las variables de su stack; no necesita
el archivo de desarrollo. En CLI, `docker stack deploy` no carga `.env` automáticamente:
exportar las variables necesarias si se opta por ese método.

### Alcance y pendientes de despliegue

Se preparan únicamente el frontend, su imagen y su publicación. No se modifican
Security, el gateway, la API LiquidAR, bases de datos, permisos ni reglas del legacy.
La disponibilidad real de los servicios, certificados, catálogo de aplicaciones,
cookies, claims, aislamiento por tenant y versión desplegada debe comprobarse en el
VPS. El build Docker valida el ApplicationId y la configuración de Nginx; la generación
de JavaScript por sí sola no certifica esa integración.

Decisiones de Nginx basadas en su [documentación oficial](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
Red y descubrimiento del servicio: [Docker Swarm](https://docs.docker.com/engine/swarm/networking/).
Validaciones de esta preparación: [validación de despliegue](docs/despliegue-validacion.md).

Referencias técnicas consultadas: [React](https://react.dev/versions), [Vite](https://vite.dev/guide/), [Vitest](https://vitest.dev/guide/).

Resultados y alcance de la verificación: [Validación de etapa 1](docs/validation.md).
