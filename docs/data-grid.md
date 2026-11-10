# DataGrid reutilizable

## Carga inicial con Skeleton

`loading=true` con `rows=[]` muestra filas decorativas compartidas con
`DataGridSkeleton`, dentro de la tabla existente y con sus columnas visibles,
anchos y altura de fila. Se muestran hasta cinco filas, limitadas por el tamaño
de página. Si ya existen filas, se conservan durante la actualización junto al
mensaje de carga. Error y vacío mantienen el comportamiento previo.
Ver [Skeleton: API y ejemplos](skeleton.md).

Componente gratuito, sin dependencias nuevas, en `src/components/ui/DataGrid`.
Usa React, HTML semántico, los componentes Button/Input/Notice y los tokens de
`theme.css`. La decisión del usuario de priorizar una solución gratuita con menos
librerías reemplaza la propuesta inicial de MUI X Pro. No incorpora Material ni
copia sus APIs internas; tampoco modifica el tema global.

## Uso básico

```tsx
import { DataGrid, type DataGridColumn } from '@/components/ui/DataGrid';

interface Registro {
  id: number;
  nombre: string;
}
const columns: DataGridColumn<Registro>[] = [
  {
    field: 'nombre',
    header: 'Nombre',
    getValue: (row) => row.nombre,
    hideable: false,
  },
];

<DataGrid
  label="Registros"
  rows={registros}
  columns={columns}
  getRowId={(row) => row.id}
  selectionMode="multiple"
/>;
```

`field` identifica de forma única la columna, incluso columnas calculadas.
`getValue` recibe la entidad tipada, evitando acceso dinámico inseguro a propiedades.
Los IDs de filas deben ser únicos y estables; no utilizar índices de página.
Mantener estables `columns`, `rows` y `getRowId` cuando sea posible.

## API

Se exportan DataGridColumn, DataGridAction, DataGridGlobalAction,
DataGridBulkAction, DataGridSelectionContext, DataGridSortModel,
DataGridFilterModel, DataGridPaginationModel, DataGridSelectionModel y DataGridProps.

Cada estado admite control externo (`model` + callback) o estado inicial interno
mediante `initialState`. El valor controlado prevalece; el callback solicita el
cambio y la grilla espera las nuevas props. No alternar controlado/no controlado
durante la vida de una instancia.

| Estado            | Prop / callback                                       | Clave de initialState |
| ----------------- | ----------------------------------------------------- | --------------------- |
| Paginación        | paginationModel / onPaginationModelChange             | pagination            |
| Ordenamiento      | sortModel / onSortModelChange                         | sort                  |
| Filtros           | filterModel / onFilterModelChange                     | filters               |
| Búsqueda          | search / onSearchChange                               | search                |
| Selección         | selectionModel / onSelectionModelChange               | selection             |
| Visibilidad       | columnVisibilityModel / onColumnVisibilityModelChange | columnVisibility      |
| Orden de columnas | columnOrder / onColumnOrderChange                     | columnOrder           |

No hay persistencia automática, HTTP, ApiClient, Zustand, React Query ni lectura
de permisos, claims o tokens. La feature administra consultas, autorización visual
y persistencia. El backend sigue siendo responsable de la autorización efectiva.

## Procesamiento y paginación

`processingMode="client"` (predeterminado) recibe el dataset completo y aplica
búsqueda, filtros AND, ordenamiento de una columna y paginación, en ese orden.
No muta `rows`. La búsqueda compara los valores de `getValue` de columnas
buscables, incluidas las ocultas; no el contenido de `render` ni `format`.
No distingue mayúsculas; sí distingue acentos.

`processingMode="server"` recibe únicamente las filas de la página. Requiere
`rowCount`, `paginationModel` y `onPaginationModelChange`. La feature debe controlar
también búsqueda, filtros y orden para construir su consulta. No se filtra ni
ordena localmente una página remota. Los modelos son de UI y no constituyen
contratos HTTP: la feature debe traducirlos al contrato real del backend.

Las páginas empiezan en cero. El tamaño debe ser un entero positivo. `rowCount`
representa el total filtrado conocido. La primera versión no contempla totales
desconocidos ni paginación por cursor. El consumidor debe mantener un total estable
durante refetch y corregir una página remota fuera de rango si disminuye el total.

Cambiar búsqueda/filtros reinicia página y selección; cambiar tamaño u ordenamiento
reinicia página pero conserva IDs seleccionados. Los cambios externos de consultas
deben ajustar esos estados desde el consumidor. La búsqueda notifica cada edición;
el debounce de peticiones y la cancelación de respuestas obsoletas corresponden a
la feature. La grilla acepta `loading`, `error` (mensaje de UI) y `onRetry`.

## Columnas y filtros

Las columnas admiten ancho, mínimo/máximo, alineación, tipo, render/format,
getSortValue/compare, sortable/filterable/searchable, initiallyHidden y hideable.
La tabla conserva desplazamiento horizontal. Los anchos se pueden modificar
arrastrando el borde derecho del encabezado. `resizable: false` desactiva esa
interacción por columna. Se respetan `minWidth` (120 px por defecto) y `maxWidth`
(10000 px por defecto). El separador permite también flechas izquierda/derecha
(10 px), Home/End (mínimo/máximo) y Escape para cancelar un arrastre.

`columnWidthsModel` y `onColumnWidthsModelChange` permiten controlar/persistir
los anchos desde la feature; `initialState.columnWidths` define anchos iniciales
internos. Durante el arrastre hay una previsualización local; el callback se emite
al soltar. Cancelar descarta la previsualización. El modo controlado espera que
el consumidor actualice las props. Ocultar/reordenar no pierde los anchos porque
se identifican por `field`. No se persisten automáticamente.

Las columnas sin ancho explícito distribuyen el espacio disponible respetando
sus máximos. Si no caben aparece scroll horizontal. Un ancho explícito o elegido
por el usuario permanece fijo. Las columnas auxiliares de selección/acciones
tienen ancho reservado y no se redimensionan con este control.

`rowHeight` configura el alto mínimo de cada fila en píxeles (48 por defecto,
mínimo admitido 32). Contenido multilínea o renders personalizados pueden requerir
más altura para conservar su legibilidad; no se recortan verticalmente para forzar
ese mínimo.

Tipos de filtro: texto (contiene/igual/comienza), número y fecha
(igual/mayor/menor), booleano y opciones (igual). Los valores de filtro son strings
serializables; un valor vacío no restringe resultados. Para fechas se comparan
instantes: usar fechas ISO `YYYY-MM-DD` o Date normalizados a medianoche UTC si
se desea igualdad por día. No se aplica una conversión implícita de zona horaria.

`filterOperators` define operadores propios y sus predicados locales;
`renderFilter` permite una UI propia con label y accesibilidad a cargo del consumidor.
Cada columna tiene un filtro activo; varios filtros se combinan mediante AND.
No se implementa un constructor de expresiones anidadadas.

El panel Columnas permite ocultar/mostrar y mover con botones de teclado.
También se pueden arrastrar los encabezados. `hideable: false` prevalece sobre
visibilidad inicial/controlada. El panel evita ocultar la última columna visible.
Nombres de columnas desconocidos en `columnOrder` se ignoran; columnas nuevas se
agregan al final. El consumidor no debe ocultar todas las columnas mediante props.

## Selección

`selectionMode`: none (predeterminado), single o multiple. `checkboxSelection`,
`selectOnClick` y `selectOnKeyboard` permiten configurar las interacciones.

- Clic simple: selecciona una fila; en single, otro clic la deselecciona.
- Ctrl/Cmd + clic: agrega o quita una fila en multiple.
- Shift + clic: agrega el rango desde el ancla dentro de la página actual.
- Checkbox: agrega/quita sin requerir Ctrl; el encabezado afecta la página actual.
- Espacio/Enter sobre fila: alterna selección. Flechas, Home y End mueven foco;
  Shift + flechas agrega el rango. Controles dentro de celdas conservan su teclado.
- Cambiar de página conserva IDs y reinicia el ancla del rango.

Modelo explícito: `{ type: 'include', ids: [...] }`. `selectAll="page"` es el
predeterminado; `none` oculta la selección de página. `dataset` agrega el botón
"Seleccionar todos los resultados".

En local, seleccionar dataset enumera IDs del conjunto filtrado. En remoto requiere
`selectionScope` y produce `{ type: 'all', excludedIds: [], scope }`. Representa
todos los resultados de esa consulta salvo IDs excluidos, sin suponer filas cargadas.
`selectionScope` debe identificar la consulta incluyendo filtros, búsqueda y contexto
del dataset; no cambia al paginar. Un modelo all de otro scope se trata como vacío.
El consumidor debe limpiar también selecciones include al cambiar de dataset.

Las acciones masivas reciben `{ model, loadedRows, count }`. `loadedRows` contiene
solo filas seleccionadas disponibles en las props actuales, nunca promete el conjunto
remoto completo. Una operación all requiere soporte real del backend: la grilla
solo representa la intención. La feature decide si habilita esa modalidad.
El contador all presupone que los IDs excluidos pertenecen al conjunto consultado;
el consumidor debe reconciliarlos si cambia ese conjunto.

## Acciones y estados

`rowActions`: id, label, onClick(row), visible(row), disabled(row).
`bulkActions`: la misma forma con DataGridSelectionContext en lugar de fila.
`globalActions`: id, label, onClick(), visible y disabled booleanos.
Todas las acciones admiten `icon: ReactNode` y `display: 'icon' | 'icon-text' | 'text'`.
También admiten `radius` (número en píxeles o valor CSS), que se pasa al Button
compartido. Por defecto heredan `--button-radius` del theme (2px).
Con icono, el valor predeterminado es `icon-text`; sin icono, `text`. `label` sigue
siendo obligatorio para accesibilidad. El modo solo icono tiene nombre accesible
y tooltip; si falta el icono se muestra el texto para evitar botones vacíos.

```tsx
import { Icon } from '@/components/ui/Icon';

const globalActions = [
  {
    id: 'new',
    label: 'Nuevo',
    icon: <Icon name="plus" />,
    display: 'icon-text' as const,
    onClick: abrirFormulario,
  },
];
const rowActions = [
  {
    id: 'view',
    label: 'Ver',
    icon: <Icon name="eye" />,
    display: 'icon' as const,
    onClick: verRegistro,
  },
];
```

`Icon` es un catálogo SVG reutilizable (search, filter, columns, plus, eye, edit),
gratuito y local, sin fuente remota ni paquetes adicionales. Hereda `currentColor`.
La API de acciones acepta también otros iconos React. La barra superior alinea las
acciones a la derecha, luego filtros/columnas solo con iconos y finalmente búsqueda
con lupa y sin título visible. El selector de tamaño de página conserva su nombre
accesible aunque se oculta el texto visual "Filas por página".

Los botones de acción no cambian selección. Acciones por fila y masivas se bloquean
durante loading/error. Acciones globales quedan bajo control del consumidor.

El estado loading se anuncia y puede conservar filas anteriores; error oculta la
tabla y permite reintentar mediante callback. `emptyMessage` configura el vacío;
si existen filtros/búsqueda se muestra un mensaje distinto de ausencia de resultados.

## Demo y validación

Con `npm.cmd run dev`, abrir `/examples/data-grid.html`. Es una entrada independiente
de desarrollo, sin ruta de aplicación, no incluida en el build principal. Demuestra
datos locales, paginación, filtros, búsqueda, selección, acciones, columnas y estados.
La segunda grilla simula el consumidor remoto sin HTTP. No integra Sindicatos.

Tests: Vitest + RTL para comportamiento y modelos; Playwright + axe para arrastre,
foco, selección y responsive en desktop/tablet/mobile. No hay virtualización:
el DOM contiene solamente la página actual; para grandes volúmenes usar server.

La versión inicial del proyecto no tiene linter. No se agrega una dependencia solo
para presentar TypeScript o Prettier como lint: esos controles se reportan por separado.
La validación de lint queda pendiente hasta que se configure una herramienta.

## Validación de la implementación inicial

Ejecutados desde `Zenthia.LiquidAR.Web` el 26/09/2026. Se utilizó `npm.cmd`
porque PowerShell bloquea `npm.ps1`. Los comandos de Vite/Vitest/Chrome se
ejecutaron con autorización fuera del sandbox después de un error `spawn EPERM`.

| Comando                                                                                                                                                                                                        | Resultado                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`                                                                                                                                                                                        | Correcto, incluidas demo y pruebas de la grilla.                                                                                                                              |
| `npm.cmd run build`                                                                                                                                                                                            | Correcto.                                                                                                                                                                     |
| `npm.cmd test -- src/components/ui/DataGrid/DataGrid.test.tsx`                                                                                                                                                 | 19 pruebas del componente correctas.                                                                                                                                          |
| `npm.cmd run test:coverage -- src/components/ui/DataGrid --coverage.include=src/components/ui/DataGrid/DataGrid.tsx --coverage.include=src/components/ui/DataGrid/model.ts --maxWorkers=1 --testTimeout=15000` | 24 pruebas correctas; statements 99,12 %, branches 95,87 %, functions 100 %, lines 99,52 %. Supera los umbrales configurados.                                                 |
| `npm.cmd run test:coverage`                                                                                                                                                                                    | Primer intento: 6 fallos de configuración y 4 timeouts bajo ejecución concurrente.                                                                                            |
| `npm.cmd run test:coverage -- --maxWorkers=1 --testTimeout=15000`                                                                                                                                              | 90 correctas, 6 fallidas en `src/lib/config.test.ts`; desaparecieron los timeouts. La suite global no está aprobada y no se obtuvo cobertura global de una ejecución exitosa. |
| `npm.cmd run test:browser -- e2e/data-grid.spec.ts`                                                                                                                                                            | Comprueba selección, orden por arrastre/botones, foco visible, ausencia de desbordamiento de página y axe WCAG en desktop/tablet/mobile. Capturas en `artifacts/browser/`.    |
| `node node_modules/prettier/bin/prettier.cjs --check src/components/ui/DataGrid examples/data-grid.html e2e/data-grid.spec.ts docs/data-grid.md vite.config.ts`                                                | Archivos de esta entrega correctos.                                                                                                                                           |
| `npm.cmd run format:check`                                                                                                                                                                                     | Falla únicamente por `src/lib/config.ts`, archivo existente no modificado.                                                                                                    |
| `npm.cmd run lint`                                                                                                                                                                                             | No ejecutable: no existe script `lint` ni linter configurado.                                                                                                                 |

Los seis fallos de configuración corresponden a un ApplicationId ausente que
actualmente recibe un valor por defecto y cinco URLs que los tests esperan rechazar,
pero cuya validación está desactivada en `config.ts`. No se cambió esa configuración
ni sus tests: pertenecen al alcance de autenticación excluido de esta tarea.

En la primera prueba de navegador se verificaba `:focus-visible` después de entrada
por mouse; se corrigió el test para activar navegación por teclado antes de comprobarlo.
La revisión de capturas motivó mantener las acciones de fila en una línea en móvil
y evitar seleccionar texto accidentalmente durante Shift+clic. Warning de ejecución:
`NO_COLOR` ignorado porque `FORCE_COLOR` está definido; no afecta resultados.

Además de los archivos nuevos de la grilla, demo, documentación y tests, se modificó
únicamente `vite.config.ts` para excluir la entrada de demo de la cobertura unitaria
(la demo se ejercita con Playwright). No se alteraron dependencias ni archivos de
autenticación, backend, Security, legacy o Sindicatos. No hay diferencias funcionales
con legacy que comparar: esta entrega crea infraestructura UI transversal nueva.

## Ajuste visual, iconos y dimensiones

Se actualizaron DataGrid, sus tipos/estilos, demo y tests; se agregaron el catálogo
compartido `components/ui/Icon.tsx`, `ActionButton`, `ColumnResizeHandle` y
`useColumnLayout`. Se mantiene la separación de negocio, servicios y seguridad.
No se modificaron dependencias, autenticación, backend ni legacy.

La demo permite cambiar la presentación de acciones y probar alturas de 36, 48
y 64 px. El nuevo modelo de anchos no usa almacenamiento y conserva el control
externo mediante callbacks. La altura es mínima para evitar cortar contenido.

Validaciones ejecutadas para este ajuste:

- `npm.cmd test -- src/components/ui/DataGrid --maxWorkers=1 --testTimeout=15000`:
  30 pruebas correctas, incluidas variantes de acciones, etiquetas accesibles,
  anchos controlados, límites y redimensionado mediante teclado.
- `npm.cmd run test:browser -- e2e/data-grid.spec.ts`: 3 pruebas correctas
  (desktop/tablet/mobile). Comprueba alineación de la barra, acciones solo con
  icono, altura real de 64 px, arrastre de ancho de 60 px sin ordenar, selección,
  reordenamiento, foco y axe WCAG sin infracciones. Captura desktop revisada.
- `npm.cmd run build`: correcto, incluida comprobación TypeScript.
- `node node_modules/prettier/bin/prettier.cjs --check src/components/ui/DataGrid src/components/ui/Icon.tsx e2e/data-grid.spec.ts docs/data-grid.md`:
  correcto.

La cobertura y las incidencias globales de la sección anterior corresponden a la
validación inicial; no se repitió la suite de autenticación ni se agregó un linter
en este ajuste. Sigue sin existir el script de lint. El único warning de navegador
fue la coexistencia de `NO_COLOR` y `FORCE_COLOR`.
