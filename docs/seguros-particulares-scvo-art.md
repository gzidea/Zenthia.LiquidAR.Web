# Seguros Particulares SCVO / ART

Ruta protegida y lazy: `/app/empresas/seguros-particulares`. El submenú Empresas
utiliza el diseño y la tipografía existentes. Por decisión posterior, se retiró
la acción «Seguros SCVO / ART» del listado de Empresas; se utiliza el submenú
Seguros Particulares SCVO / ART con el selector superior de empresa.

## Contexto y datos

La empresa proviene de `useEmpresaContextStore`, el mismo contexto que utiliza
el selector superior. Sin selección se muestra el mensaje «Primero seleccioná
una empresa desde el selector del menú superior para consultar sus seguros»;
no se monta la grilla ni se consulta el historial.

La vista de empresa se monta con clave por ID. Cambiar o limpiar la selección
descarta el formulario, las filas seleccionadas, la paginación y los mensajes
anteriores. React Query separa los historiales por empresa y consume señales de
cancelación. El encabezado y el modal identifican nombre e ID de la destinataria.

Se reutilizan GET y POST `/api/empresas/{id}/seguros`, el hook y servicio de
seguros, DataGrid y SegurosDialog en modo formulario. La paginación es local
sobre el historial completo: 25 filas inicialmente, opciones 10/25/50/100 y
orden del servidor. Búsqueda, filtros y ordenamiento permanecen deshabilitados.
No se incorporan dependencias, endpoints ni cambios de backend.

## Publicación y seguridad

Consulta: `empresas:read`. Publicación: `empresas:write`. El backend aplica
autorización y aislamiento por tenant; la selección del frontend no concede
privilegios. Estas condiciones particulares no modifican los valores centrales
SCVO/FFEP. La alícuota y el fijo ART provienen del contrato, y el fijo excluye FFEP.

Nuevo y Copiar abren una nueva revisión. Copiar conserva condiciones, vigencias
y la diferencia entre importes vacíos y cero, pero limpia el motivo. Se mantienen
validación, control de revisión esperada, manejo de errores y caché compartidos
con Empresas. Éxito cierra el nuevo modal y confirma; un conflicto conserva el
borrador y permite refrescar el historial sin republicar automáticamente.

El modal fija su ID al abrirse y comprueba el contexto antes de enviar. Durante
la publicación bloquea la selección global de empresa y el cierre; el bloqueo
se libera al terminar o desmontarse. Las operaciones normales del contexto no
cambian la empresa mientras está bloqueado. Un cambio de sesión siempre limpia
empresa y bloqueo. Los otros accesos al modal no dependen del selector global.

Se conserva la publicación por revisiones; no se agregan edición o eliminación
del historial ni se recalculan recibos guardados. Esta tarea agrega un acceso
independiente al comportamiento existente, sin ampliar otras funciones legacy.

## Validación

Pruebas de menú y contexto con Vitest. Playwright cubre sin selección, selección
y cambio de empresa, historial vacío, alta y copia, validaciones, bloqueo durante
escritura, conflicto, error de consulta y reintento, limpieza de selección y
regresión del acceso desde Empresas. Capturas de grilla y formulario en
escritorio, tablet y móvil, con verificación de accesibilidad del modal.
Las respuestas HTTP son simuladas: no se comprueba persistencia en una base real.
