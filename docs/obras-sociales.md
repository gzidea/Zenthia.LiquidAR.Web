# Obras Sociales: migración al frontend

Ruta protegida y lazy: `/app/obras-sociales`. Implementación orientada a feature,
con el patrón del **código actual** de Sindicatos: página → hooks React Query →
servicio → ApiClient. El formulario utiliza React Hook Form y Zod; los datos
remotos permanecen en React Query. No se agregaron dependencias.

## Fuentes y decisiones del plan aprobado

- Referencia frontend: `src/features/sindicatos`, DataGrid, Modal, Skeleton,
  AppRoutes, AppShell y cliente HTTP existentes, inspeccionados directamente.
- Legacy: `Zenthia.LiquidAR/Zenthia.LiquidAR.Win/Views/ObrasSociales`, sus
  ViewModels y `Zenthia.AccesoDatos/Models/ObrasSociales.vb`.
  El archivo real se llama `ObraSocialEditForm.vb`, acompañado por su Designer;
  no `ObraSocialEditFom.vb`.
- Backend: `LiquidAR.Net10/src/LiquidAR.Api/Endpoints/ObrasSocialesEndpoints*`,
  `ObraSocialWriteRequest`, `ObraSocialResponse`, Application/ObrasSociales,
  persistencia y `Configuration/CatalogAuthorization.cs`.
- **No determinado:** la ubicación de una exportación independiente del módulo.
  Se usó el módulo completo disponible en el legacy y se informó esta ausencia
  en el análisis aprobado. `LiquidAR.Net10/docs/migracion/ObrasSociales.md`
  complementa el análisis, sin sustituir al código real.
- El prompt menciona Material UI. El plan aprobado conserva los controles y el
  tema propios que utiliza Sindicatos actualmente, sin instalar otra librería.

## Funcionalidad

Listado remoto, refrescar, selección por página, selector/reordenamiento/ancho
de columnas, consulta, alta, edición y eliminación confirmada. Primera página
de 25 registros, tamaños 10/25/50/100; se corrige la página si el total disminuye.
La selección no ofrece operaciones masivas inexistentes.

Columnas iniciales por decisión explícita del usuario: Código, Nombre, Email y
Teléfono, con Acciones visible. Las demás columnas permanecen disponibles en el
selector, ocultas inicialmente. Esto reemplaza la selección inicial más amplia
del legacy, que incluía porcentajes, importes y base de cálculo.

Validación de la actualización de columnas y acciones compartidas con Sindicatos:
63 pruebas de los dos módulos y Modal, más 12 escenarios Playwright en escritorio,
tablet y móvil, aprobados. Build, TypeScript y Prettier aprobados. Las pruebas
de navegador verifican las cuatro columnas y Acciones, con API simulada.

El formulario reproduce las agrupaciones y orden del Designer con Flex/Grid:
código corto; nombre, dirección y código postal a lo ancho; provincia corta;
contacto en dos columnas; grupo inferior de porcentajes/importes y base de cálculo.
En móvil se apilan los campos. Consulta reutiliza el formulario en modo readonly.

Los modos de guardado del legacy se presentan como acciones del Modal:

- **Guardar:** continúa editando el registro devuelto por la API, incluido su ID
  si se acaba de crear. Un siguiente guardado realiza PUT, sin repetir el alta.
- **Guardar y cerrar:** cierra tras éxito y muestra confirmación en el listado.
- **Guardar y nuevo:** abre un alta limpia tras guardar.
- **Deshacer:** limpia el alta o vuelve a consultar el registro en edición.
- **Cancelar/Cerrar:** descarta el borrador. Durante una escritura se bloquean
  campos y acciones incompatibles; ante error se conserva el borrador.

El guardado incorpora la respuesta al caché de detalle e invalida los listados.
Al abrir edición se espera la consulta actualizada antes de montar el formulario.
El detalle no se recarga por foco/reconexión para evitar reemplazar un borrador.

## Contrato utilizado

Rutas relativas a la base de LiquidAR, que incluye `/api`:

| Método | Ruta                                 | Uso                                   |
| ------ | ------------------------------------ | ------------------------------------- |
| GET    | `/obras-sociales?page=1&pageSize=25` | Listado `{items,page,pageSize,total}` |
| GET    | `/obras-sociales/{id}`               | Detalle actualizado para edición      |
| GET    | `/obras-sociales/provincias`         | Selector `{id,nombre}`                |
| POST   | `/obras-sociales`                    | Alta, 201 con entidad                 |
| PUT    | `/obras-sociales/{id}`               | Actualización, 200 con entidad        |
| DELETE | `/obras-sociales/{id}`               | Baja, 204 incluso si ya no existe     |

Los 12 campos editables son nullable: `codigo`, `nombre`, `direccion`,
`codigoPostal`, `idProvincia`, `email`, `telefono`, `porcientoAporte`,
`porcientoRetencion`, `importeAporte`, `importeRetencion`, `baseDeCalculo`.

Código, email, teléfono y base de cálculo admiten hasta 255 caracteres. Código
postal y provincia son Int32; porcentajes, números finitos; importes,
decimal(19,4) enviados como cadenas con punto, sin conversión a Number.
No se impone obligatoriedad, formato de email, importes positivos ni rango
0–100 para porcentajes. Se preservan espacios y cadenas vacías ya almacenadas.
Una provincia ausente del catálogo conserva su valor original al editar.

`localidad` es **solo lectura** en el contrato y no tiene editor enlazado en el
formulario legacy. Está disponible en consulta y como columna opcional; nunca
se envía en POST/PUT. Tampoco se envían ID, nombre de provincia ni contexto de
seguridad en el body. El backend conserva Localidad durante la actualización.

Búsqueda, filtros y orden configurable no están soportados por esta API: quedan
deshabilitados, con explicación, sin filtrar u ordenar únicamente la página
recibida. Los errores 400/401/403/404/409 y de red siguen el manejo centralizado;
solo se incorporaron los tres mensajes de negocio revisados de Obras Sociales.

## Seguridad

Permisos exactos: `obrassociales:read`, `obrassociales:write` y
`obrassociales:delete`. Lectura controla ruta/contenido y enlace del menú;
escritura controla alta/edición; eliminación se evalúa independientemente.
Las acciones requieren también lectura para operar dentro de la pantalla.

Se reutiliza `/users/me` de Security y `usePermissions`. El ApiClient de LiquidAR
envía el access token vigente como Bearer desde el mecanismo existente, usando
`VITE_LIQUIDAR_BASE_URL`. No se crea otro almacenamiento ni mecanismo de sesión.

La autorización efectiva pertenece al backend. `CatalogAuthorization` actual
permite SuperAdmin sin depender de los permisos ni del tenant/application
configurados para el módulo; los usuarios comunes deben cumplir esas condiciones.
Esto difiere de la documentación antigua del backend: se siguió el código actual.
No se modificaron Security, backend ni configuración de permisos.

El catálogo se consulta en `/obras-sociales/provincias`, protegido para este
módulo; no en `/provincias`, que utiliza Sindicatos y tiene otra autorización.
Solo se comparte el tipo `Provincia`; servicios y cachés mantienen sus ámbitos.

## Componentes y archivos

Reutilizados sin crear versiones alternativas: DataGrid, Modal, FormDialogActions, Skeleton,
DataGridSkeleton, Input, Button, Icon, Notice, usePermissions y ApiClient.

Nuevos en `src/features/obras-sociales`:

- `pages/ObrasSocialesPage.tsx` y `pages/obras-sociales.css`.
- `components/ObraSocialForm.tsx`, `ObraSocialFormLayout.tsx` y
  `ObraSocialFormSkeleton.tsx`. Layout es interno al módulo y mantiene idéntica
  distribución entre formulario real y skeleton.
- `hooks/useObrasSociales.ts`, `services/obraSocialService.ts`,
  `schemas/obraSocialSchema.ts`, `types/obraSocial.ts`.
- Tests de página, formulario, schema y servicio junto a esos archivos.

Otros archivos nuevos: `src/types/provincia.ts`, `e2e/obras-sociales.spec.ts`
y este documento.

Modificados: `src/app/AppRoutes.tsx`, `src/layouts/AppShell.tsx`,
`src/services/http/ApiClient.ts` y su test. En Sindicatos solo se reemplazó la
declaración duplicada de Provincia por una reexportación del tipo compartido;
sus consumidores, servicio y comportamiento permanecen iguales.

## Carga y diferencias respecto de las referencias

Permisos pendientes muestran DataGridSkeleton. El listado usa las filas skeleton
del DataGrid; alta/edición muestran un formulario decorativo con 12 campos.
Los errores sustituyen el skeleton y ofrecen reintento. El borde superior del
header conserva la regla compartida `1px solid var(--rule)`, igual al inferior.

Frente a Sindicatos: Localidad no es editable y cambia la ruta/autorización de
provincias. Por pedido posterior del usuario, Sindicatos también utiliza los
tres modos de guardado, Deshacer y Refrescar. Ambos módulos comparten
`components/ui/Modal/FormDialogActions.tsx` para las acciones adicionales y la
interpretación del destino de guardado. Obras Sociales pasa a ser la referencia
de interfaz para futuras migraciones; cada módulo conserva sus contratos y reglas.

Frente al escritorio: Ribbon y barra de estado se adaptan a toolbar, footer y
mensajes web. La personalización usa el DataGrid compartido; no se migran layouts
binarios persistentes de DevExpress. El preview de impresión está comentado en
el legacy y no se presenta como función disponible. Búsqueda/filtros/orden remotos
requieren ampliar el contrato backend; no se emulan en el cliente.

## Validación y límites

Tests unitarios/integrados cubren contratos, precisión decimal, campos,
permisos, carga, errores, vacío, paginación, cancelación, consulta readonly,
alta/edición, los tres destinos de guardado, Deshacer y eliminación.
Playwright verifica navegación/ruta, Bearer y payload, CRUD, skeleton sin saltos,
bordes del header, responsive y Axe en desktop, tablet y móvil.

Las pruebas utilizan API simulada. **No determinado:** provisión real de los
permisos en Security y configuración de JWT/CORS/tenant/application en el entorno
de despliegue. Falta la aceptación contra API y base de datos reales; no se ha
afirmado validar persistencia real. No existe script de lint en el proyecto:
se utiliza TypeScript y Prettier para los chequeos disponibles.

Resultados de ejecución de la migración:

- `npm.cmd run build`: TypeScript y bundle de producción aprobados.
- `npm.cmd test -- --maxWorkers=1`: 184 pruebas aprobadas y 6 fallos
  preexistentes en `src/lib/config.test.ts`, ya documentados antes de esta tarea.
  Fallan las expectativas sobre ApplicationId ausente y restricciones de URL;
  no se modificaron esos archivos. Pasaron las 22 pruebas de la feature y las
  tres nuevas comprobaciones de mensajes de Obras Sociales en ApiClient.
- La primera comprobación visual encontró un salto de 11 px debido al ajuste
  de línea de Código postal. Se corrigió el ancho de las etiquetas compartido
  por formulario/skeleton; la prueba exige diferencia de altura máxima de 1 px.
- `npm.cmd run test:browser -- e2e/obras-sociales.spec.ts`: 6 escenarios
  aprobados en Chrome (desktop 1440×1000, tablet 768×1024 y móvil 360×800).
  Incluyen CRUD, destinos de guardado, permisos/ruta, payload y Bearer,
  estabilidad del skeleton, igualdad de bordes, cierre por teclado, ausencia
  de desborde horizontal de la página y Axe sin infracciones detectadas.
  Las capturas y el reporte quedan en `artifacts/browser` y
  `artifacts/browser-report` (se regeneran al volver a ejecutar Playwright).
