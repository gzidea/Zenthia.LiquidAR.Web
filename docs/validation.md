# Etapa 1: entrega y validación

Fecha: 25 de septiembre de 2026. Aplicación: **Zenthia.LiquidAR.Web**. Entorno: Windows, Node 24.19.0 y npm 12.0.2.

## Resultado y alcance

Base implementada: login, bienvenida de primer ingreso, cambio obligatorio/voluntario, rutas protegidas, shell, logout, ApiClient y estado de autenticación/UI. Respeta la decisión de no consumir `/me`. La restauración tras recarga y el refresh automático quedan pendientes de Security; no se presentan como funcionalidades terminadas ni se simulan en producción.

Contrato real, cookies, cache y requisitos del endpoint futuro: [security-session.md](security-session.md). Configuración y arquitectura: [README](../README.md).

## Archivos creados

| Área                  | Archivos                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proyecto              | `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.env.example`, `.gitignore`, `.prettierrc.json`, `.prettierignore`                                              |
| Arranque y navegación | `src/main.tsx`, `src/vite-env.d.ts`, `src/app/AppRoutes.tsx`, `SessionLifecycle.tsx`, `HomePage.tsx`                                                                                                                         |
| Autenticación         | `src/features/auth/pages/{LoginPage,FirstLoginPage,ChangePasswordPage}.tsx`, `components/{AuthCard,StepFolio,LogoutButton}.tsx`, `schemas/authSchemas.ts`, `services/authService.ts`, `stores/authStore.ts`, `types/auth.ts` |
| HTTP y configuración  | `src/services/http/{ApiClient,ApiError}.ts`, `src/lib/config.ts`                                                                                                                                                             |
| UI                    | `src/components/Brand.tsx`, `src/components/ui/{Button,Input,Notice}.tsx`, `src/layouts/{AuthLayout,AppShell}.tsx`, `src/stores/uiStore.ts`, `src/styles/theme.css`                                                          |
| Tests                 | `src/app/AppRoutes.test.tsx`, `src/features/auth/services/authService.test.ts`, `src/services/http/ApiClient.test.ts`, `src/lib/config.test.ts`, `src/test/{setup,fixtures}.ts`                                              |
| Navegador             | `playwright.config.ts`, `e2e/auth.spec.ts`                                                                                                                                                                                   |
| Documentación         | `README.md`, `docs/security-session.md`, `docs/validation.md`                                                                                                                                                                |

Los directorios preexistentes de referencia y `AGENTS.md` se conservaron. No se inicializó un repositorio ni se realizaron commits.

## Dependencias

React 19.3.0, TypeScript 7.0.2, Vite 8.3.1, Router 7.18.4, Zustand 5.0.15, Axios 1.20.0, React Hook Form 7.88.0 y Zod 4.6.5. Vitest 5.0.2 y React Testing Library 16.3.3. Versiones exactas y árbol reproducible en manifest/lockfile. El README justifica cada dependencia, incluidas tipografías locales y herramientas de navegador.

## Flujo implementado

```text
Login → POST /api/auth/login → cookies HttpOnly de Security
  ├─ requiresPasswordChange = false → /app
  └─ requiresPasswordChange = true
       ├─ firstLogin = true → /first-login → /change-password
       └─ firstLogin = false → /change-password
             ↓
       PUT /api/users/ exitoso → /app (misma sesión)

Cerrar sesión → POST /api/auth/revoke → limpiar contexto → /login
Vencimiento / 401 autenticado → limpiar contexto → /login
Recarga → contexto desconocido → /login (sin consultar /me)
```

Zustand conserva datos de login, flags, vencimiento, revisión de sesión y sidebar en memoria. No guarda tokens, contraseñas, datos de negocio ni cache remoto. ApiClient aplica URL same-origin, cookies, timeout, normalización de errores y 401 vinculado a la revisión vigente. AuthService serializa mutaciones y descarta respuestas obsoletas. Las reglas de cada ruta y el diseño adaptado de liquidar-onboarding están detallados en el README.

## Vitest y Testing Library

**72 tests aprobados, 4 archivos**, ejecutados con `npm.cmd run test:coverage`.

- Login: render, campos requeridos, errores asociados, loading, credenciales inválidas, limpieza de contraseña, reintento y éxito.
- Rutas: anónimo, autenticado, primer ingreso, cambio requerido, acceso directo protegido, retorno desde login y 404.
- Cambio: campos, coincidencia, loading, error, éxito, navegación sin repetir login y cambio voluntario.
- Sesión: inicialización idempotente sin HTTP, expiración por temporizador/foco, respuesta obsoleta y mutaciones concurrentes.
- Logout: endpoint, loading, éxito, limpieza de UI y fallo de red sin fingir cierre remoto.
- ApiClient: configuración, cookies/headers, categorías de errores, mensajes seguros, 401 de login y 401 autenticado/atrasado.
- Configuración: ApplicationId inválido/ausente, rango Int32 y URL same-origin.

| Métrica    | Cobertura |
| ---------- | --------: |
| Statements |   99,50 % |
| Branches   |   98,85 % |
| Functions  |   98,57 % |
| Lines      |   99,46 % |

Umbrales: 80 % statements/lines/functions y 75 % branches. Reportes generados en `coverage/index.html` y `coverage/lcov.info`.

## Chrome, responsive y accesibilidad

**6 tests aprobados** con `npm.cmd run test:browser`: escritorio 1440 × 1000, tablet 768 × 1024 y móvil 360 × 800.

En cada tamaño se recorrieron login, bienvenida, cambio, shell y logout. Sin desborde horizontal, sin errores JavaScript y sin infracciones detectadas por axe para WCAG 2 A/AA y 2.1 AA en las pantallas comprobadas. Se verificó el menú móvil. Una prueba por tamaño conserva una cookie HttpOnly de fixture y recarga: vuelve a login sin consultar `/me`, refresh ni un endpoint inventado.

Se revisaron visualmente capturas de login y shell de escritorio, bienvenida de tablet y login, cambio y menú de móvil. No se observaron solapamientos de tarjetas, textos o controles en esas capturas. Reporte y capturas en `artifacts/browser-report/index.html` y `artifacts/browser/`.

Estas comprobaciones no sustituyen una auditoría manual completa con lector de pantalla. No se validaron otros navegadores.

## Build y formato

- TypeScript aprobado, aplicación y configuraciones Vite/Playwright.
- Build Vite aprobado; salida en `dist/`.
- Prettier aplicado al frontend y documentación; verificación con `npm.cmd run format:check`.
- La instalación npm informó cero vulnerabilidades conocidas en ese momento.

Vite/Vitest necesitaron ejecución fuera del sandbox de Windows por restricciones de creación de subprocesos. No se cambió la política de PowerShell ni se desactivó TLS. Se usó `npm.cmd`.

## Pendientes de integración

No se ejecutó autenticación contra Security real: faltan ApplicationId del ambiente, endpoint futuro, usuario de prueba y configuración HTTPS/gateway. No se afirma haber validado Set-Cookie real, BD, Redis, persistencia ni revocación reales.

Los pendientes concretos de Security están documentados en [security-session.md](security-session.md): endpoint futuro sin `/me`, FirstLogin, refresh con AccessToken vacío, guardado de refresh tokens, cache realmente utilizado, revocación y condiciones de despliegue. No se modificaron Security, base de datos, backend LiquidAR ni Legacy para ocultar esas limitaciones.

## Recibos: errores de PDF y recálculo desde Novedades (2026-10-21)

El cliente HTTP decodifica el JSON recibido como Blob en descargas fallidas antes de normalizar el error y ejecutar el parser del servicio. Los mensajes del PDF se muestran únicamente si pertenecen al conjunto revisado de errores de negocio; un cuerpo inválido o desconocido conserva el mensaje HTTP genérico.

Novedades ofrece Recalcular recibo en filas con recibo, resultados de liquidación y errores de PDF relacionados con detalles, totales o costos. Usa la capacidad existente `generar`, evaluada por el backend con `Permission.Recibos.Write`, y `POST /api/recibos/{id}/recalcular` sin body. La API conserva la autorización efectiva. No se agregan permisos ni contratos de Security.

La confirmación identifica el recibo, legajo y período, y advierte que persiste importes que pueden cambiar. Con borradores pendientes la acción queda bloqueada; durante la operación se bloquean cierre, contexto y envíos repetidos. No adopta escalas ni reglas automáticamente. Los errores 422 de cálculo se interpretan como `ReciboCalculoDto`, con mensajes revisados por código de diagnóstico; los códigos desconocidos tienen una explicación genérica. Los conflictos conservan el diálogo para revisar y reintentar.

El éxito requiere `reciboId` coincidente, `calculado=true` y `persistido=true`. Invalida las consultas de Novedades, retira resultados anteriores y ofrece Reintentar PDF sin descargar automáticamente. El PDF puede seguir rechazándose por otras validaciones; el éxito del recálculo no implica éxito de impresión.

Pruebas: normalización de Blob JSON e inválido, mensajes permitidos, diagnósticos, confirmación, cancelación, capacidad de escritura, bloqueo durante el recálculo y borradores pendientes. La revisión visual utiliza respuestas sintéticas, sin persistencia sobre la base real. La causa original de la inconsistencia del recibo 4 queda fuera de este cambio.

Validación ejecutada para este cambio: 29 pruebas pertinentes aprobadas (cliente HTTP, parsers y pantalla), TypeScript, build de producción y Prettier de los archivos modificados. Flujo en Edge con respuestas HTTP sintéticas aprobado: error PDF 422, confirmación, recálculo 200 y opción de reintento. Capturas revisadas en `artifacts/recibos-recalculo/` para escritorio (1440 px), tablet (768 px) y móvil (390 px). No se validó recálculo contra la base real. Vite conserva una advertencia de chunk principal mayor a 500 kB.

## Previsualización compartida de recibos (2026-10-21)

`src/components/recibos/ReciboPreview.tsx` contiene el esquema extraído de la demo: identidad, secciones empleador/trabajador, totales, grupos de costos y gráfico. Sus estilos tienen un ámbito propio y no dependen del CSS de la demo. `ReciboHtml` queda como adaptador de la demo, único lugar que incorpora datos ficticios. Los importes se formatean para presentación; React no calcula salarios ni decide la integridad.

Novedades reemplaza la tabla con identificadores/descripciones mezclados por Ver previsualización en los resultados y Previsualizar recibo en las filas guardadas. El Modal utiliza React Query, skeleton, reintento, datos tipados y lectura cancelable. Las tablas permiten desplazamiento horizontal y por teclado. Los conceptos muestran la descripción preparada por backend, sin utilizar IDs como texto alternativo.

Contrato nuevo: `GET /recibos/{id}/previsualizacion`, política existente de lectura de recibos. El backend devuelve los datos guardados y su diagnóstico incluso si no se puede emitir PDF; `datosCompletos` representa la integridad de datos. La generación agrega `vista` al resultado de simulación. Ambos orígenes comparten el componente, pero solo el persistido puede ofrecer PDF y recálculo. La capacidad existente `generar` controla la acción de escritura y el backend mantiene la autorización efectiva. No se modificó Security.

Un recálculo desde la previsualización requiere confirmación, invalida las consultas y abre nuevamente una lectura del recibo guardado. Durante la lectura no se muestra una versión anterior en cache como si ya estuviera actualizada. Las novedades pendientes bloquean el recálculo y se explicita que la vista corresponde al estado anterior.

La raíz del rechazo del PDF del recibo 4 quedó confirmada por consulta de solo lectura: detalles con dos decimales reales frente a cuatro de cabecera/grupos, aunque EF declaraba cuatro para todos. El backend comprueba ahora las cotas de redondeo independiente con la precisión real del esquema. No se ejecutó DDL ni se modificaron importes de la base. Se comprobó la generación del PDF real en memoria, sin guardar el documento salarial. Ver `LiquidAR.Net10/docs/migracion/Recibos-Pdf.md` para el criterio y las diferencias respecto del contrato supuesto anteriormente.

Se conserva una diferencia preexistente de gráficos: la demo representa neto más el total de cada grupo; el recibo real representa neto más las contribuciones positivas del empleador, igual que su PDF. Los adaptadores suministran esa composición al componente común.

Validación de esta mejora: 79 pruebas unitarias backend pertinentes aprobadas; en una pasada previa se aprobaron 519 pruebas unitarias en total, antes del último ajuste de precisión real. `dotnet build LiquidAR.sln --artifacts-path tmp/recibo-check --no-restore` aprobó sin errores ni advertencias. Los directorios de compilación aislados evitan sobrescribir los ensamblados de la API de desarrollo que estaba en ejecución. La comprobación HTTP nueva aprobó lectura autorizada, rechazo 401/403, 404, alias versionado, no-store y concordancia entre diagnóstico de vista y rechazo del PDF. La suite HTTP ampliada fue interrumpida al no terminar durante la revisión; no se afirma que haya aprobado completa.

Frontend: 58 pruebas pertinentes aprobadas; después del último endurecimiento del adaptador se repitieron sus 10 pruebas, con éxito. TypeScript, build de producción y Prettier aprobados. Dos pruebas Playwright de regresión de demo aprobaron en escritorio y móvil con Edge. El flujo adicional de navegador aprobó previsualización guardada, recálculo con relectura y simulación sin emisión. Capturas revisadas en escritorio, tablet y móvil bajo `artifacts/recibo-preview/`; capturas de regresión de la demo bajo `artifacts/browser/`. Vite conserva la advertencia preexistente del chunk principal mayor a 500 kB.

Para cargar el nuevo endpoint y la corrección del PDF debe reiniciarse la API de desarrollo con el código actualizado; no se detuvo el servidor que ya estaba ejecutándose. No se realizaron commits ni cambios en Security o en la base de datos.

Cierre de verificación: aprobaron las 5 pruebas HTTP pertinentes de previsualización/PDF, con lectura autorizada, alias, errores 401/403/404/422/503, descarga/inline y no-store. El último build frontend también aprobó después de los ajustes finales del adaptador.

## Novedades y Liquidaciones independientes (2026-10-22)

Las referencias anteriores a acciones de recibos en Novedades describen el flujo histórico. Ahora el menú y las rutas separan `/app/novedades` (carga) y `/app/liquidaciones` (consulta y emisión). El nuevo servicio y sus hooks consultan `/api/liquidaciones`; el acceso al menú se obtiene de capacidades calculadas por la API con sus permisos reales de recibos, sin inventar permisos en Security.

Novedades mantiene carga individual, masiva, pegado e importación. Un registro liquidado queda de solo lectura. Liquidaciones conserva búsqueda, filtros de convenio/situación, paginación, simulación, confirmación de generación, PDF y recálculo. La corrección explícita reutiliza el editor y requiere lectura/escritura de ambos módulos; el servidor conserva revisión y atomicidad por legajo.

Los legajos pendientes permanecen visibles, con icono y descripción de las fórmulas faltantes. `DataGrid.isRowSelectable` excluye filas bloqueadas de selección individual, por rango y de toda la página. Antes del envío la pantalla toma solo filas habilitadas de la página; el backend vuelve a validar bajo bloqueo. Cantidad o importe cero cuentan como carga; ambos nulos siguen pendientes. Si faltan días se informa el valor de categoría; vacaciones sin informar se muestran como 0, por decisión del usuario. No se persisten novedades ficticias ni se agregan variables al motor.

Los servicios, parsers y diálogo de recibos se comparten desde `features/recibos`, usando el componente `ReciboPreview` existente. Los errores de PDF/recálculo también se muestran dentro del diálogo abierto. Guardar en Novedades ya no recalcula; las correcciones deben realizarse desde Liquidaciones.

Verificaciones: 58 pruebas pertinentes de novedades, recibos, liquidaciones y DataGrid; 27 pruebas de autenticación/rutas; TypeScript y build aprobados. Incluyen el guardado explícito de correcciones con la revisión del registro. También aprobaron las 3 pruebas Playwright de carga, importación/conflictos y consulta de Novedades. La primera ejecución concurrente de Vitest tuvo timeouts de workers; la ejecución con un worker aprobó. Flujo de Liquidaciones en Edge con respuestas sintéticas: selección masiva excluye bloqueados y recibos existentes, generación exige confirmación y la vista usa el recibo común. Capturas revisadas en `artifacts/liquidaciones/` a 1440, 768 y 390 px, sin desbordamiento de la página; la grilla permite desplazamiento horizontal.

Backend: 72 pruebas unitarias pertinentes y 6 HTTP aprobadas, incluidos permisos independientes. No se modificaron Security, legacy ni la base de datos; no se emitieron recibos reales. Hay que reiniciar la API y actualizar el frontend juntos para utilizar los endpoints nuevos. Los endpoints de generación anteriores se conservan por compatibilidad.

## Descarga de recibos en ZIP (2026-10-23)

Liquidaciones incorpora **Vista de Liquidaciones → Recibos generados**. La
selección de descarga admite recibos guardados y mantiene separadas las
restricciones para generar liquidaciones. Usa el filtro remoto `generados`,
los filtros de contexto/convenio y selección por página, hasta 100 recibos.
El botón posterior a la generación incluye únicamente resultados calculados,
persistidos y exitosos; no incluye simulaciones ni errores de un lote parcial.

`features/recibos` incorpora mutation, servicio y parser de errores del contrato
`POST /recibos/pdf/zip`. La API devuelve un solo Blob ZIP o errores por recibo;
no hay descargas parciales silenciosas. El usuario puede quitar los fallidos
de la selección y reintentar. Mientras se prepara, se bloquean acciones y
contexto y se ofrece cancelar mediante AbortController. Al desmontar se
cancela la petición. No se reintentan automáticamente escrituras/descargas.

ApiClient acepta nombres planos seguros PDF/ZIP en Content-Disposition. La
descarga usa el helper común de URL de Blob; no persiste tokens, recibos ni
enlaces públicos. Requiere lectura de recibos según las capacidades del backend,
sin exigir generación ni permisos de Novedades. La API mantiene la autorización
efectiva y las validaciones individuales del PDF, con límites de 100 recibos
y 64 MiB.

Verificado con pruebas de selección, permisos de lectura, cancelación,
exclusión tras error, filtrado de mensajes y nombres de archivo. Build de
producción y TypeScript aprobados. Edge con respuestas sintéticas verificó
rechazo sin descarga parcial y descarga única tras quitar el recibo fallido;
capturas revisadas a 1440, 768 y 390 px bajo `artifacts/recibos-zip/`. La grilla
permite desplazamiento horizontal sin desbordar la página. La primera prueba
visual detectó que el mock no exponía Content-Disposition por CORS; se corrigió
el mock para representar el header ya expuesto por la API real.

Backend: 29 pruebas unitarias de PDF/ZIP y 2 HTTP aprobadas, con ZIP legible y
contenido PDF, alias, 401/403, límites e integridad. No hubo cambios en Security,
legacy, esquema ni datos reales. Se necesita reiniciar la API y actualizar
el frontend juntos. Los límites acotan cada solicitud; no se implementó una
cola para lotes mayores ni se midió carga concurrente de producción.

## Recibos en menú independiente (2026-10-23)

El listado histórico se trasladó de la vista de Liquidaciones a `/app/recibos`.
Esta actualización reemplaza las referencias anteriores a “Recibos generados”
como vista interna de Liquidaciones. El menú Recibos requiere capacidad de
lectura de recibos; Liquidaciones requiere escritura. No se interpretan nombres
de políticas como permisos del token ni se inventan permisos en Security.

Recibos utiliza `GET /recibos/listado`, filtros de período, tipo y empresa,
búsqueda por legajo/nombre/apellido/CUIL, paginación y orden remoto. Presenta
código real del legajo, apellido, nombre, CUIL y los siete importes guardados:
bruto, remunerativo, no remunerativo, descuentos, neto, contribuciones y costo
laboral. Los importes nulos dicen “Sin calcular”; no se calculan ni se sustituyen
por cero. Empresa, período, tipo y fecha están disponibles en el selector de
columnas. Los recibos sin legajo relacionado permanecen visibles.

Se reutilizan DataGrid, Select, Modal y previsualización común de solo lectura,
PDF individual y ZIP por página. El componente compartido ZipFeedback conserva
errores por recibo, cancelación y exclusión explícita sin descargar lotes
incompletos. El listado no ofrece generar ni recalcular.

Liquidaciones mantiene las operaciones de generación y el ZIP inmediato de
resultados efectivamente guardados. La consulta de recibos históricos ya no
está en esa pantalla. Un usuario de escritura sin lectura puede liquidar, pero
no descargar ZIP; se explica junto al botón deshabilitado. Para generar y
descargar necesita ambos permisos, según el plan aprobado.

Build y TypeScript aprobados. Pruebas de interfaz cubren columnas, código de
legajo distinto del ID interno, nulos, búsqueda/orden remotos, selección ZIP,
exclusión, cancelación y separación de acceso. Edge con respuestas sintéticas
verificó menús independientes, vista guardada sin recálculo, descarga ZIP y
generación con solo escritura; capturas revisadas en escritorio, tablet y móvil
bajo `artifacts/recibos-listado/`. La tabla permite desplazamiento horizontal
para mostrar todos los importes sin desbordar la página.

Las 14 pruebas HTTP pertinentes aprobaron, incluidos aliases, filtros inválidos,
ausencia de escritura al consultar, lectura/escritura independientes y ZIP. La
prueba SQL valida traducción de joins izquierdos, búsqueda y los 13 órdenes
permitidos. No se modificaron Security, legacy ni esquema/datos reales. Se
requiere actualizar ambas aplicaciones y reiniciar la API. Detalle del contrato
y diferencias en `LiquidAR.Net10/docs/migracion/Recibos-Listado.md`.
