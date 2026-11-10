# Skeleton reutilizable

Importar desde `@/components/ui/Skeleton`. Los componentes son exclusivamente visuales: el consumidor decide cuándo renderizarlos. No contienen HTTP, formularios funcionales, estado global, permisos ni autenticación. No agregan dependencias.

## API

| Componente         | Props y valores predeterminados                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Skeleton`         | `variant='text'` (`text`, `rectangular`, `circular`, `rounded`), `width`, `height`, `count=1`, `gap='var(--space-2)'`                           |
| `FormSkeleton`     | `fields=6` (cantidad o array de `FormSkeletonField`), `columns=1` (1–4), `gap='var(--space-4)'`, `actions=true`, `label='Cargando formulario…'` |
| `SkeletonActions`  | `count=2`, `width=104`, `height=46`, `gap='var(--space-2)'`, `align='end'` (`start`, `center`, `end`)                                           |
| `DataGridSkeleton` | `rows=5`, `columns=4`, `columnWidths=[]`, `header=true`, `selection=false`, `actions=false`, `rowHeight=48`, `label='Cargando registros…'`      |

Los cuatro admiten `animation='pulse'` o `false`, `className` y `style: CSSProperties`. Dimensiones numéricas representan píxeles; también se admiten valores CSS como porcentajes y `rem`. En `Skeleton`, `width`/`height` corresponden a cada bloque; `style` corresponde al contenedor. Las cantidades se truncan a enteros no negativos; valores no finitos usan el valor predeterminado. Configurar cantidades pequeñas de placeholders, no el total remoto de registros.

`FormSkeletonField` admite `kind` (`input` predeterminado, `select`, `textarea`, `checkbox`, `section`), `fullWidth`, `width` y `height`. Las secciones ocupan todo el ancho y representan una separación con título. El textarea mide 100 px por defecto; inputs/selects, 46 px. `actions=false` omite el pie; un objeto permite configurar `SkeletonActions`.

Los formularios se adaptan al ancho **de su contenedor**: una columna hasta 32 rem; hasta dos desde 32 rem; la cantidad solicitada desde 52 rem. `columns` es el máximo. `fullWidth` ocupa todas las columnas disponibles. Esto también funciona en un modal pequeño abierto en una pantalla grande.

`columnWidths` corresponde exclusivamente a las columnas de datos; admite porcentajes o dimensiones CSS, y las entradas omitidas comparten el espacio restante. Las columnas decorativas de selección y acciones se agregan aparte. `rowHeight` expresa la altura aproximada: el contenido puede exigir más espacio. Para una grilla muy angosta con anchos explícitos, el scroll queda dentro del contenedor.

## Skeleton básico

```tsx
import { Skeleton } from '@/components/ui/Skeleton';

<>
  <p role="status">Cargando resumen…</p>
  <div aria-busy={true}>
    <Skeleton variant="text" count={3} width="80%" gap={8} />
    <Skeleton variant="circular" width={40} height={40} />
    <Skeleton variant="rectangular" height={120} animation={false} />
  </div>
</>;
```

`Skeleton` y `SkeletonActions` son decorativos (`aria-hidden`) y no anuncian estado por sí mismos. El consumidor debe proporcionar el mensaje y marcar la región que carga. No producen controles enfocables. Las composiciones de formulario y grilla independiente ya incluyen un único `role='status'`, separado de su grupo con `aria-busy`, para no retener el anuncio dentro de una región ocupada. No envolverlas en otro anuncio de carga.

## Formulario en una página

```tsx
import { FormSkeleton } from '@/components/ui/Skeleton';

<FormSkeleton
  columns={2}
  fields={[
    { kind: 'input' },
    { kind: 'select' },
    { kind: 'section' },
    { kind: 'textarea', fullWidth: true, height: 120 },
    { kind: 'checkbox' },
  ]}
  actions={{ count: 2, height: 40 }}
  label="Cargando datos del formulario…"
/>;
```

Para una configuración uniforme basta `<FormSkeleton fields={6} columns={2} />`. Ajustar la descripción visual a la estructura del formulario real para reducir saltos de layout. No crea `<form>`, labels reales ni validaciones.

## Formulario dentro de Modal

```tsx
import { Modal } from '@/components/ui/Modal';
import {
  FormSkeleton,
  Skeleton,
  SkeletonActions,
} from '@/components/ui/Skeleton';

<Modal
  open={open}
  onClose={() => setOpen(false)}
  size="medium"
  title={
    <>
      <span className="skeleton-sr-only">Editar registro</span>
      <Skeleton width="60%" height={16} />
    </>
  }
  footer={{ type: 'custom', content: <SkeletonActions /> }}
>
  <FormSkeleton fields={6} columns={2} actions={false} />
</Modal>;
```

Si el título ya se conoce, preferir `title="Editar registro"`. El texto oculto del ejemplo mantiene el nombre accesible cuando el título visual carga: el Modal usa `aria-labelledby` si tiene título. No usar un Skeleton solo como título. El footer personalizado evita duplicar botones reales y decorativos. La apertura, el cierre y el foco siguen a cargo del Modal y del consumidor; no hay un segundo diálogo ni un `DialogSkeleton` redundante.

## Grilla

```tsx
import { DataGridSkeleton } from '@/components/ui/Skeleton';

<DataGridSkeleton
  rows={5}
  columns={3}
  columnWidths={['20%', '50%', '30%']}
  selection
  actions
  rowHeight={48}
/>;
```

El DataGrid real integra automáticamente los placeholders con su prop existente:

```tsx
<DataGrid
  label="Registros"
  rows={rows}
  columns={columns}
  getRowId={(row) => row.id}
  loading={loading}
/>
```

Con `loading=true` y `rows=[]`, renderiza hasta cinco filas decorativas (limitadas por el tamaño de página) dentro del `tbody` original. Reutiliza columnas visibles y ordenadas, anchos calculados, encabezados, selección, acciones y altura de fila. No renderiza una segunda tabla ni duplica anuncios. Con filas disponibles, mantiene datos y el aviso de actualización. Los estados de error y vacío conservan su comportamiento anterior.

`DataGridSkeletonRows` es la composición compartida exportada para tablas propias: solo devuelve `tr`/`td` decorativos, debe colocarse dentro de un `tbody` y recibe `rows`, `columns`, `selection`, `actions`, `rowHeight` y `animation`. La tabla consumidora proporciona anchos, estilos, mensaje accesible y estado ocupado.

## Tema, ejemplos y validación

El CSS usa `--rule`, `--card`, `--white`, `--radius` y los espaciados existentes. La animación pulse se desactiva con `prefers-reduced-motion`. No se introduce un tema oscuro: los colores siguen los tokens del tema que provea el consumidor.

Ejemplos ejecutables con Vite en `/examples/skeleton.html`, siguiendo el catálogo HTML existente. No se agrega Storybook. No se reemplazan formularios ni estados de carga particulares de módulos de negocio; la integración transversal es únicamente con DataGrid.

Pruebas: `npm.cmd test -- src/components/ui/Skeleton src/components/ui/DataGrid src/components/ui/Modal`, `npm.cmd run test:browser -- e2e/skeleton.spec.ts`, `npm.cmd run build` y Prettier sobre archivos modificados. El proyecto no dispone de script de lint independiente.

Resultados de esta entrega: 55 tests de DataGrid/Modal y 9 de Skeleton aprobados (estos últimos tras ajustar una expectativa de rem a píxeles calculados); 6 pruebas de Chrome aprobadas en desktop, tablet y mobile, sin infracciones de Axe en los ejemplos. Build y TypeScript aprobados. Capturas revisadas en `artifacts/browser` para página completa y tamaños de modal. No se ejecutó la suite completa de módulos de negocio ni coverage global. El navegador emite únicamente el aviso de entorno `NO_COLOR`/`FORCE_COLOR` de Playwright.

Archivos nuevos: carpeta `src/components/ui/Skeleton` (componentes, tipos, estilos, tests y ejemplos), `examples/skeleton.html`, `e2e/skeleton.spec.ts` y este documento. Modificados: `DataGrid.tsx` para la carga inicial, `DataGrid.test.tsx` para regresiones, `Modal.test.tsx` para composición y `docs/data-grid.md`. No cambian el runtime del Modal, reglas legacy, contratos, permisos ni autenticación. Las adopciones en formularios de negocio quedan a cargo de futuras tareas; no hay pendientes dentro del alcance aprobado.
