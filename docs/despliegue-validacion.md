# Despliegue de LiquidAR Web — decisiones y validación

Fecha: 2026-11-09. Alcance: preparar GitHub Actions, imagen de frontend, Compose de
producción para Swarm, Compose local y guía de Portainer/Nginx Proxy Manager.

## Configuración y arquitectura

Se tomó como referencia el circuito de Zenthia.Administrar.Web, adaptándolo a los
contratos actuales de LiquidAR. El puerto 8090 y el origen
`https://liquidar-api.zenthia.ar/` fueron confirmados por el usuario; el origen se
configura sin la barra final. Security conserva el gateway de desarrollo y de
Administrar, `https://gateway.zenthia.ar`.

La imagen se construye desde el repositorio independiente. Incluye copias exactas de
app-shell 0.1.1 y ui 0.1.2, verificadas mediante SHA-512 contra package-lock.json y los
artefactos de Shared. No se actualizaron dependencias, lockfile ni fuentes compartidas.
El paquete security-client de Administrar no se incorpora a LiquidAR.

El Dockerfile fija `/api` como base de Security y `/liquidar-api` como base de LiquidAR.
Nginx traduce el segundo prefijo a los endpoints `/api/*` del backend real. No se agregó
ningún endpoint a las APIs ni al gateway. El gateway inspeccionado tiene rutas de
Security y Reference, sin las rutas de negocio de LiquidAR; no se reutilizó como
destino de esas operaciones por inferencia.

En producción se propone el stack `zenthia-liquidar-web` y el servicio `liquidar-web`:
el nombre completo de Swarm será `zenthia-liquidar-web_liquidar-web`. Se conecta a la
red externa `external_zenthia`, con una réplica y reinicio administrado por Swarm.
El archivo utiliza versión 3.8 para el formato de stack; Compose moderno avisa que
ese campo es obsoleto para su propio modo de ejecución, sin impedir validarlo.

## Seguridad y diferencias técnicas

- Se conserva AuthService, ApiClient, el ciclo de sesión, tokens privados en memoria,
  permisos y contexto de tenant. No se generaron credenciales, claims o permisos.
- La ruta de Security conserva cookies y excluye Authorization. La de LiquidAR
  conserva Bearer y el contexto existente, elimina Cookie de la petición y Set-Cookie
  de la respuesta. Esto evita enviar cookies de Security al backend de negocio al
  compartir ahora el origen del navegador; no convierte cookies en Bearer.
- Nginx conserva Date del upstream para la compatibilidad del reloj de sesión y
  valida los certificados de los upstreams HTTPS con las autoridades del sistema.
- El proxy de LiquidAR permite 120 segundos de espera, de acuerdo con los timeouts
  existentes para operaciones largas. No impone el límite adicional de cuerpo de
  Nginx: se delega la validación al backend, donde la planilla de novedades admite
  hasta 10 MB. El proxy exterior debe acompañar estas condiciones.
- La construcción exige un ApplicationId válido, aunque `src/lib/config.ts` permite
  actualmente un fallback de ID 1. Se evita publicar sin configuración explícita;
  no se modificó ese comportamiento del código de aplicación ni su validación de URL.
- El Compose local publica únicamente `127.0.0.1:8090` y no necesita la red de Swarm.
  Los archivos `.env` personales permanecieron sin cambios y fuera del build aislado.

No se cambian reglas funcionales del legacy. Las diferencias de URL son del proxy y
del empaquetado; Security y LiquidAR conservan sus contratos y autorización efectiva.

## Comprobaciones ejecutadas

| Comprobación                                              | Resultado                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `actionlint` v1.7.12 sobre `.github/workflows/deploy.yml` | Aprobado                                                                                     |
| Sintaxis Bash del script de inicio                        | Aprobada                                                                                     |
| Validación de ambos orígenes                              | 36 casos sintéticos aprobados, sin llamadas de red                                           |
| Compose de producción, `config --format json`             | Imagen parametrizada, 8090:80, dos orígenes confirmados, red externa y una réplica correctos |
| `docker stack config --compose-file docker-compose.yml`   | Aprobado; compatible con el parser nativo de Swarm                                           |
| Compose local, `config --format json`                     | Build con ID de fixture 42, loopback 8090 y sin red externa correctos                        |
| Producción sin imagen y local sin ApplicationId           | Rechazados como se esperaba                                                                  |
| Integridad de ambos `.tgz`                                | Coincide con el lockfile y con los artefactos originales                                     |
| Formato de los archivos de despliegue y README            | Aprobado con Prettier                                                                        |
| Espacios finales y terminación LF del script              | Aprobados                                                                                    |

Las validaciones de Compose utilizaron un archivo de entorno vacío y valores sintéticos,
sin leer ni escribir `.env`. La imagen de comprobación fue
`ghcr.io/example/zenthia.liquidar.web:latest`, sin hacer pull ni publicación.

## Instalación y build aislados

Se copió la aplicación a
`output/liquidar-web-deploy-review-20261109/isolated/workspace/Zenthia.LiquidAR.Web`,
con las dos copias incluidas para reconstruir la ruta relativa de npm. No se copiaron
node_modules, `.env`, certificados ni fuentes de Shared u otras aplicaciones.

Comandos y resultados:

- `npm.cmd ci --no-audit --no-fund --cache C:/Proyectos/Codex/.npm-cache`: aprobado,
  166 paquetes instalados desde el lockfile.
- `npm.cmd run build`: TypeScript y Vite aprobados, con ID sintético 42, base Security
  `/api` y base LiquidAR `/liquidar-api`, como en el Dockerfile.
- El JavaScript generado contiene `/liquidar-api` y no contiene la dirección LAN de
  ejemplo `http://192.168.1.4:5000/api`.

## Nginx real con upstreams simulados

Para comprobar el enrutamiento pese a que el motor Docker no está disponible, se
descargó Nginx 1.30.6 para Windows desde el sitio oficial, fuera del proyecto. Se
ejecutó la plantilla real con dos servidores HTTP sintéticos en loopback. Solo se
adaptaron los orígenes, puerto de escucha, raíz de archivos y ruta del almacén de CA
al entorno de prueba. No se instaló un servicio del sistema ni se llamó a las APIs reales.

**10 comprobaciones aprobadas, cero fallidas:**

1. Nginx acepta la configuración.
2. `/health` responde 204.
3. `/login` utiliza el fallback de SPA y no-cache.
4. `/demo/recibo` utiliza el mismo fallback.
5. Los recursos existentes tienen caché inmutable y los ausentes responden 404.
6. Security recibe ruta, query, método y cookies; no recibe Bearer. Su Set-Cookie y Date
   llegan al cliente.
7. LiquidAR recibe `/api/*`, query, Bearer y contexto de tenant; no recibe Cookie y su
   Set-Cookie no llega al cliente. Se conserva Date.
8. Un cuerpo sintético de 2 MB llega íntegro, superando el límite predeterminado de 1 MB.
9. Se conservan el contenido y encabezado de descarga de un PDF sintético.
10. Los errores 401 y 404 de upstream siguen siendo respuestas de API, no HTML de SPA.

El proceso de Nginx y ambos servidores de fixtures se cerraron al terminar. Evidencia:
[resultados del proxy](../../output/liquidar-web-deploy-review-20261109/proxy-results.json)
y [script de comprobación](../../output/liquidar-web-deploy-review-20261109/check-proxy.cjs).
Esto valida el proxy de Nginx en Windows, no el contenedor Linux/Alpine.

## Regresiones de aplicación

Se ejecutó `npm.cmd test -- src/features/auth src/services/http --maxWorkers=1` en
la copia aislada: 61 pruebas correctas en seis archivos, con código de salida 1 porque
Vitest agotó la espera al iniciar el worker forks de `authService.test.ts`. No hubo
una aserción funcional fallida en esos seis archivos. La repetición del archivo
pendiente utiliza threads para separar ese problema de arranque del comportamiento
de la aplicación. No se modificaron los tests.

La repetición con
`npm.cmd test -- src/features/auth/services/authService.test.ts --maxWorkers=1 --pool=threads`
terminó correctamente: **20 pruebas aprobadas**, código 0. Sumadas a las 61 anteriores,
quedaron aprobadas las **81 pruebas de autenticación y HTTP** de los siete archivos.

`npm.cmd test -- src/lib/config.test.ts --maxWorkers=1 --pool=threads` terminó con
código 1: **8 aprobadas y 6 fallidas**. Son las discrepancias ya documentadas respecto
del ID por defecto y las cinco variantes de URL que el código actual acepta. Las
fuentes y los tests de configuración permanecen iguales; no se corrigieron reglas
de la aplicación durante la preparación del despliegue.

`npm.cmd run test:browser -- e2e/auth.spec.ts e2e/zenthia-shared.spec.ts` terminó con
código 1: **3 escenarios aprobados y 6 fallidos**, en escritorio, tablet y móvil.

- La regresión del shell y componentes compartidos aprobó en los tres tamaños.
- El flujo histórico de primer ingreso/cambio/logout falla: el fixture rechaza
  `/api/liquidaciones/capacidades`, la expectativa de retorno a login no se cumple
  y, en móvil, el selector parcial de botón «Menú» coincide con dos elementos.
- La restauración histórica falla al esperar el encabezado de la página de inicio.
  Su fixture de refresh omite `accessTokenRemainingMilliseconds` y Date, referencias
  de tiempo requeridas por el cliente actual; se muestra el estado de reintento de sesión.
- Estos escenarios se ejecutaron con Vite y los archivos existentes, sin utilizar
  el proxy nuevo ni modificar el comportamiento para hacer pasar las expectativas.
  No se afirma que la suite completa esté aprobada ni que la autenticación real del
  VPS haya sido validada.

El reporte, capturas, contextos de error y traces están en
`output/liquidar-web-deploy-review-20261109/isolated/workspace/Zenthia.LiquidAR.Web/artifacts`.
Las 313 huellas de fuentes, pruebas existentes, configuraciones y lockfile coinciden
con el estado anterior a esta tarea. No se ejecutó la suite completa de los módulos
de negocio, dado que no fueron modificados.

## Límites y preparación pendiente

`docker build --pull --build-arg SECURITY_APPLICATION_ID=42 --tag zenthia-liquidar-web:review .`
terminó con código 1: no está disponible `dockerDesktopLinuxEngine`. No se construyó
ni ejecutó localmente la imagen Linux/Alpine ni su healthcheck. El Dockerfile incorpora
`nginx -t` con orígenes sintéticos para ejecutarlo durante la construcción en GitHub.

No se ejecutó el workflow real, no se publicó en GHCR ni se llamó a ningún webhook.
No se modificaron Security, gateway, backend, bases de datos o cuentas reales; no se
inicializó Git ni se hicieron ramas, commits o push. El nombre del repositorio, el
ApplicationId real, el webhook y el hostname HTTPS propio quedan por configurar.
Los dominios, red overlay, registro privado, certificados, cookies, API y permisos
deben verificarse en el VPS con los servicios realmente desplegados.

Fuentes técnicas: [proxy de Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[distribución oficial](https://nginx.org/en/download.html) y
[redes de Swarm](https://docs.docker.com/engine/swarm/networking/).
# Corrección TLS del proxy (2026-11-10)

Se compararon los `.env.example` de Administrar y LiquidAR: ambos utilizan
`SECURITY_API_ORIGIN=https://gateway.zenthia.ar`. No se requiere cambiar ese destino.
LiquidAR activa la verificación TLS del upstream; Administrar no la activa.

Se reprodujo con Nginx 1.30.6 para Windows y el gateway real, sin credenciales:
GET `/api/auth/login` con verificación activa y profundidad 1 devuelve 502 con
`unable to get local issuer certificate`; con profundidad 5 devuelve 405 sin
errores TLS (el endpoint requiere POST). Se utilizó el mismo almacén de raíces
públicas de Node en ambas pruebas. Evidencia y script en
`output/liquidar-web-deploy-review-20261109/check-gateway-tls.cjs` del workspace.

Se establece `proxy_ssl_verify_depth 5` en ambos upstreams sin desactivar la
verificación de certificados. No cambia el contrato de autenticación ni las
rutas. Falta confirmar la nueva imagen en el VPS y el login real mediante HTTPS;
la reproducción local no sustituye esa validación.
