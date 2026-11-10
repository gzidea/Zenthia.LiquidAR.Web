# Bancos: migración al frontend

Ruta protegida y lazy: `/app/bancos`. La referencia principal solicitada es el
código actual de **Sindicatos**, inspeccionado directamente. Se aplican también
los componentes y comportamientos compartidos con Obras Sociales que figuran
en el AGENTS del frontend, incluidos los tres modos de guardado y Deshacer.

## Fuentes y alcance

Se leyeron los AGENTS raíz y frontend, la feature actual de Sindicatos,
DataGrid/Modal/Skeleton, routing, navegación, cliente HTTP y permisos.
El legacy utilizado está en `Zenthia.LiquidAR/Zenthia.LiquidAR.Win/Views/Bancos`,
`ViewModels/Bancos` y `Zenthia.AccesoDatos/Models/Bancos.vb`.
El contrato se contrastó con `LiquidAR.Net10/src/LiquidAR.Api/Endpoints/Banco*`,
Application/Bancos, el adaptador BCRA y CatalogAuthorization.

El módulo comprende listado, consulta, alta, edición, eliminación física y
actualización desde BCRA. Esta última es una funcionalidad real del legacy,
no un complemento opcional del ABM. EmpresasBancos, pagos, LSD y recibos son
consumidores relacionados que permanecen fuera del alcance de esta migración.
No se modifican backend, Security, base de datos, AGENTS ni dependencias.

## Interfaz

DataGrid compartido con Código, Denominación, Abreviación y Acciones visibles;
ID disponible como columna oculta. Inicio de 25 registros, tamaños 10/25/50/100,
filas de 48 px, selección múltiple por página, contador, selector de columnas,
ancho y orden de columnas. La selección no implica operaciones masivas.
Refrescar vuelve a consultar y Nuevo abre el alta, según permisos.

Ver reutiliza el formulario readonly. Edición espera el detalle actualizado;
durante la carga muestra un skeleton con las mismas clases y dimensiones.
Alta no requiere datos auxiliares y se abre directamente, sin carga ficticia.
El formulario adapta el Designer: código y denominación en la primera fila,
abreviación debajo; en móvil se apilan. Las acciones usan Modal y
FormDialogActions, sin replicar Ribbon ni coordenadas WinForms.

- Guardar mantiene el diálogo editando el ID devuelto por la API; un segundo
  guardado tras el alta utiliza PUT.
- Guardar y nuevo inicia un alta limpia después del éxito.
- Guardar y cerrar cierra después del éxito.
- Deshacer limpia el alta o recarga el registro en edición.
- Cancelar descarta cambios locales. Durante una escritura se bloquean campos,
  acciones incompatibles y cierre del diálogo.

Errores conservan el borrador y se asocian a campos cuando corresponde. Los
éxitos actualizan el caché de detalle e invalidan listados. Edición no recarga
por foco/reconexión para evitar sustituir borradores. La baja requiere confirmación
y conserva el diálogo ante conflictos. Si disminuye el total, se corrige la página.

La consulta de permisos usa DataGridSkeleton; el listado utiliza las filas
skeleton del DataGrid. Se mantienen los bordes superior e inferior del header
con `1px solid var(--rule)`. Se contemplan error, reintento, vacío y éxito.

## Contrato real

Rutas relativas a `VITE_LIQUIDAR_BASE_URL`, que incluye `/api`:

| Método | Ruta                            | Resultado                                          |
| ------ | ------------------------------- | -------------------------------------------------- |
| GET    | `/bancos?page=1&pageSize=25`    | `{items,page,pageSize,total}`                      |
| GET    | `/bancos/{id}`                  | Banco o 404                                        |
| POST   | `/bancos`                       | 201 con Banco                                      |
| PUT    | `/bancos/{id}`                  | 200 con Banco o 404                                |
| DELETE | `/bancos/{id}`                  | 204, también si ya no existe                       |
| POST   | `/bancos/actualizar-desde-bcra` | 200 resumen, 409 parcial, 502 fuente no disponible |

Banco devuelve `id`, `codigoEntidad`, `denominacion` y `abreviacion`.
El body de escritura contiene solamente los últimos tres campos; no incluye
identidad ni tenant/application/user.

- `codigoEntidad`: Int32 no nullable; valor inicial 0. Se aceptan cero y negativos,
  sin imponer unicidad. La UI exige una representación válida del entero al enviar;
  un campo vacío no se convierte silenciosamente en otro código.
- `denominacion`: string nullable, máximo 255 caracteres.
- `abreviacion`: string nullable, máximo 20 caracteres.
- No se agregan Required sobre los textos, trimming ni reglas de negocio nuevas.
  Se conservan espacios, null y cadenas vacías existentes, siguiendo Sindicatos.

No hay combos ni dependencias con provincias. La API no acepta búsqueda,
filtros ni orden configurable: esos controles permanecen deshabilitados con
explicación, sin transformar únicamente la página recibida.

## Actualización desde BCRA

La acción del toolbar abre un diálogo que explica el alcance; Actualizar ejecuta
un único POST sin body. El frontend llama exclusivamente a LiquidAR, nunca al
proveedor externo directamente. El backend incorpora códigos faltantes, no cambia
existentes ni elimina ausentes y confirma cada guardado, igual que el legacy.

El resumen validado contiene `incorporados`, `omitidos` y
`fallidos: [{codigoEntidad,motivo}]`. En HTTP 409 viene dentro de `resultado`
en ProblemDetails. El servicio conserva ese resultado en BcraImportError;
el diálogo muestra los contadores y la lista de códigos fallidos. Los motivos
son los mensajes seguros del contrato; cualquier motivo desconocido se sustituye
por un mensaje genérico. Una respuesta incompatible no se presenta como éxito.

El listado se invalida al finalizar, incluso ante error, porque puede haber
persistencia parcial. No se revierte ni se promete revertir lo incorporado.
No hay reintento HTTP/mutation automático ni botón de repetición sobre el resultado;
una nueva ejecución requiere volver a abrir la acción y pulsar Actualizar.

El timeout de esta operación es 120 segundos, frente a los 15 segundos habituales,
para permitir la espera del HttpClient externo del backend (100 segundos) más
procesamiento. No garantiza finalizar lotes de duración arbitraria. Una pérdida
de conexión, cancelación o respuesta incompatible puede impedir confirmar el
resultado tras guardados parciales: la UI indica revisar el listado antes de repetir.
Se bloquea el cierre normal durante el proceso; cerrar/recargar el navegador no
garantiza cancelar ni revertir lo que ya procesó el servidor.

El comportamiento peculiar del backend que puede reutilizar una entidad pendiente
después de un error se conserva. La UI presenta el resumen recibido; no corrige
ni reproduce esa lógica de negocio en React.

## Arquitectura y seguridad

Página/formulario → hooks React Query → BancoService → ApiClient → backend.
Los datos remotos permanecen en React Query; estado local para diálogo, destino
y feedback. React Hook Form/Zod validan el contrato de entrada.

Se reutilizan DataGrid, Modal, FormDialogActions, Skeleton, Input, Button, Icon,
Notice, usePermissions y el mecanismo de autenticación existente. El cliente
LiquidAR envía Bearer desde la sesión actual sin añadir almacenamiento de tokens.

Permisos exactos del backend: `bancos:read`, `bancos:write`, `bancos:delete`.
BCRA usa `bancos:write`. La UI requiere lectura para operar dentro del módulo;
escritura y eliminación se comprueban independientemente. El menú respeta lectura.
La autorización efectiva pertenece al backend y su contexto autenticado.

Discrepancia detectada: la documentación histórica de Bancos afirma que SuperAdmin
no omite permiso/scope. CatalogAuthorization actual sí lo permite. Se sigue ese
código y el usePermissions existente; los usuarios comunes requieren permiso y
tenant/application configurados coincidentes. No se inventan permisos ni roles.

ApiClient conserva normalización y expiración de sesión en su método request.
Se agregaron dos opciones genéricas y optativas: timeout por petición y parser
del error de un endpoint. Solo BancoService interpreta el resultado BCRA mediante
Zod; no se almacena ni se expone el cuerpo crudo del error desde los componentes.
Los otros servicios mantienen las opciones y mensajes habituales.

## Archivos

Nueva feature `src/features/bancos`:

- `types/banco.ts`, `schemas/bancoSchema.ts`.
- `services/bancoService.ts`, `services/bcraResult.ts`.
- `hooks/useBancos.ts`.
- `components/BancoForm.tsx`, `BancoFormSkeleton.tsx`, `BcraImportDialog.tsx`.
- `pages/BancosPage.tsx`, `pages/bancos.css`.
- Tests de schema, formulario, servicio y página junto a esos archivos.

Además, `e2e/bancos.spec.ts` y este documento. Integración en
`src/app/AppRoutes.tsx`, `src/layouts/AppShell.tsx` y
`src/services/http/ApiClient.ts`.

## Diferencias y límites

- ID visible en legacy, oculto inicialmente en la web siguiendo Sindicatos;
  sigue disponible en el selector. Campos editables y operaciones se conservan.
- Paginación remota y controles de grilla web sustituyen la colección y layouts
  DevExpress; no se migran layouts binarios de escritorio.
- Eliminar se ofrece desde el listado con confirmación, siguiendo Sindicatos,
  en lugar de duplicar la acción dentro del editor.
- El backend aporta un resumen BCRA que el legacy no mostraba; la web lo presenta
  y distingue los errores parciales de una descarga fallida.
- BancosDetails aparece como declaración sin uso funcional identificado; no se
  inventa una pantalla de detalle dependiente.

**No determinado:** provisión efectiva de permisos en Security, disponibilidad
real de BCRA, configuración JWT/CORS/scope y efectos de las FK de la base instalada.
La validación automatizada usa APIs simuladas; no se ejecutan importaciones ni
escrituras sobre una base real. Esos puntos requieren aceptación en el entorno
integrado. No hay script de lint; se usan TypeScript y Prettier.
