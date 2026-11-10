# Modal nativo reutilizable

`src/components/ui/Modal` usa `<dialog>.showModal()` y un portal React al body.
No agrega dependencias, servicios, estado global ni decisiones de autorización.
El navegador administra modalidad y aislamiento del contenido exterior; el
componente configura el foco inicial, restaura el disparador y bloquea/restaura
el scroll. El bloqueo compartido respeta modales superpuestos.

## Uso

```tsx
import { Modal } from '@/components/ui/Modal';

<Modal
  open={open}
  title="Confirmar operación"
  onClose={() => setOpen(false)}
  onAccept={guardar}
  acceptButton={{ label: 'Guardar', loading: saving, radius: 8 }}
  cancelButton={{ label: 'Cancelar', radius: 8 }}
  closeDisabled={saving}
>
  <Contenido />
</Modal>;
```

`children` y `title` aceptan ReactNode. Sin título, indicar `ariaLabel`; no se
reserva un header vacío. `ariaDescribedBy` puede apuntar al ID de una descripción.
`titleIcon` admite un icono React separado del título para mantener su alineación
con el texto y el botón de cierre. La cabecera simple tiene 36 px de alto; el
título ocupa una línea, con elipsis si no cabe. Los títulos string también tienen
tooltip con su texto completo, y el nombre accesible conserva ese texto.

`subtitle` admite ReactNode y se muestra con fuente menor debajo del título,
alineado con su texto (no con el icono). En ese caso la cabecera tiene un mínimo
de 48 px y crece si el subtítulo ocupa más líneas. Se incorpora automáticamente
a `aria-describedby`, junto con cualquier descripción proporcionada. Icono y
subtítulo acompañan un título visible; no crean cabecera si este está ausente.

```tsx
<Modal
  open={open}
  title="Editar registro"
  titleIcon={<Icon name="edit" />}
  subtitle="Completá los datos del registro."
  onClose={() => setOpen(false)}
>
  <Contenido />
</Modal>
```

`initialFocusRef` permite enfocar un elemento del body. Por defecto se enfoca el
título, o el body cuando no hay título. Los nodos del modal se desmontan al cerrar;
guardar fuera del modal cualquier estado de formulario que deba persistir.

`open` es siempre controlado. `onClose(reason)` solicita el cierre, sin mantener
una segunda fuente de verdad. Motivos: cancel, close-button, escape, backdrop y
native (por ejemplo un formulario con method="dialog"). Escape y cierres nativos
se reconcilian con `open`; el consumidor debe actualizarlo para cerrar.

`disableEscapeClose`, `disableBackdropClose`, `showCloseButton` y `closeDisabled`
configuran el cierre. `closeDisabled` bloquea las solicitudes del componente,
no impide que el consumidor cambie `open` directamente. Backdrop solo solicita
cierre si el gesto comienza y termina fuera del contenido del dialog.

## Footer, botones y formularios

- Footer estándar por defecto, o `footer={{ type: 'standard' }}`.
- Cancelar aparece por defecto y solicita cierre. `onCancel` reemplaza esa acción.
- Aceptar aparece cuando se proporciona `onAccept` o `acceptButton`.
- `acceptButton={false}` y `cancelButton={false}` ocultan esas acciones.
- Botones: label, disabled, loading, loadingLabel, icon, display y radius.
- `actions={<Acciones />}` agrega contenido a la izquierda del footer estándar.
- `footer={{ type: 'custom', content: <MiFooter /> }}` reemplaza el footer entero.
- `footer={null}` lo oculta. El contenido personalizado se renderiza sin interpretarlo.

Aceptar no cierra automáticamente. La feature administra su operación async,
`loading`, errores y cierre tras éxito. Si `onAccept` devuelve una promesa, su
callback debe manejar el rechazo; el modal no traduce ni presenta errores de negocio.
Durante una operación puede combinarse `loading` con `closeDisabled`.

Para conectar un botón del footer a un formulario en el body:

```tsx
<Modal
  open={open}
  title="Formulario"
  onClose={() => setOpen(false)}
  acceptButton={{ label: 'Guardar', type: 'submit', form: 'registro-form' }}
>
  <form id="registro-form" onSubmit={handleSubmit(guardar)}>
    <Campos />
  </form>
</Modal>
```

En modo submit se usa el evento nativo del formulario; no se ejecuta también
`onAccept`. IDs de formulario deben ser únicos. React Hook Form y Zod permanecen
en el consumidor; el Modal no depende de ellos. Footer personalizado administra
sus propios botones, estados y cierres.

## Botón compartido y radio de esquinas

Todos los botones estándar de Modal y DataGrid utilizan
`src/components/ui/Button.tsx`. ModalButton y ActionButton son adaptadores de
presentación, no controles nativos duplicados.

```tsx
<Button radius={8}>Guardar</Button>
<Button radius="999px">Continuar</Button>
<Button radius="var(--radius)">Usar token</Button>
```

`radius` acepta el tipo CSS de borderRadius. Un número se expresa en píxeles;
una cadena puede contener unidades o variables CSS. Si hay también
`style.borderRadius`, `radius` explícito prevalece. Al omitirlo, se conserva
`style` y finalmente el token global `--button-radius`, con valor inicial 2px
para mantener la apariencia existente.

Modal expone esa misma prop en `acceptButton` y `cancelButton`; DataGrid la expone
en acciones globales, por fila y masivas. Botones personalizados de cualquier
footer pueden usar Button directamente. El token puede ajustarse globalmente o
heredarse desde un contenedor; no se necesita repetir estilos en cada botón.

## Layout y accesibilidad

Tamaños small, medium (predeterminado) y large. `fullWidth` utiliza el ancho
disponible del viewport, manteniendo márgenes. El CSS usa tokens de la app;
las anchuras se centralizan en variables `--modal-width-*` del componente.
Body tiene scroll independiente, con header/footer disponibles. Un footer
personalizado muy extenso también tiene scroll limitado para no ocupar toda
la pantalla. Foco visible, nombres accesibles y spinner con reduced-motion.

Se requiere un navegador con dialog nativo. No se incluye polyfill de producción
ni se simula modalidad con un div. La demo `/examples/modal.html` muestra tamaños,
radios de botones, formulario, operación async, errores, footer personalizado,
contenido extenso y modales superpuestos. No se agrega una ruta a la aplicación.

## Estado de validación

- TypeScript pasó después de corregir el uso de eventos nativos en los tests.
- Primer test unitario: 19 correctos y 3 fallidos por helpers `fireEvent.cancel`
  y `fireEvent.close` inexistentes. Fueron reemplazados por eventos DOM nativos;
  la repetición y cobertura quedaron pendientes por bloqueo de revisión automática.
- Primera prueba de navegador: 9/12 correctas (formulario async, error, scroll,
  responsive, axe, footer personalizado y modales superpuestos en tres tamaños).
  Las otras 3 se detuvieron por una expectativa de `:focus-visible` tras entrada
  con mouse. La comprobación se trasladó al botón después de Tab; falta repetirla.
- jsdom no implementa showModal/close: se usa un adaptador solo dentro del archivo
  de tests. Las pruebas de Chrome verifican la modalidad real del navegador.
- No hay linter configurado en el proyecto. Build y cobertura del modal pendientes.

El intento de ejecutar cobertura fuera del sandbox no se ejecutó: la revisión
automática no pudo completarse por límite de uso, no por un dictamen de inseguridad.
No se modificaron autenticación, backend, Security, contratos ni legacy. La demo
se excluye de cobertura unitaria en vite.config.ts y se ejercita con Playwright.
