# Valores Generales SCVO / FFEP

Pantalla: `/app/empresas/valores-generales`, dentro de AppShell, con carga diferida.
El acceso se realiza desde el submenú Empresas → Valores Generales SCVO / FFEP.
Por decisión posterior, se retiró la acción «Valores SCVO / FFEP» del listado de Empresas.

La pantalla utiliza DataGrid y los controles compartidos del proyecto. Muestra
parámetro, régimen, importe, vigencias, revisión, fuente y motivo. Ofrece refresco,
selector de columnas y paginación local de 25 registros (10/25/50/100), porque
GET `/api/seguros/parametros` devuelve el historial completo sin paginación.
Se conserva el orden del backend. Búsqueda, filtros y ordenamiento permanecen
deshabilitados; no se agregan operaciones masivas.

Nuevo y Copiar abren SegurosDialog en modo formulario, con los mismos campos,
validaciones y publicación que el acceso de Empresas. Copiar conserva la
configuración y vigencia, pero vacía el motivo. POST `/api/seguros/parametros`
publica una nueva revisión por código y régimen usando `revisionEsperada`.
No existen operaciones de edición o eliminación en este contrato.

La consulta se habilita con `empresas:read`, conforme al acceso desde el menú
Empresas. La escritura requiere SuperAdmin y la política `formulas:write`,
validadas efectivamente por el backend. Los parámetros son centrales: no se
asocian a la empresa seleccionada. No se crean permisos, endpoints ni tablas.

La pantalla y el modal existente comparten hooks, servicio, formulario y cache
React Query. Una publicación invalida el historial común. En la nueva pantalla,
el éxito cierra el formulario y muestra confirmación; el modal de Empresas
conserva su comportamiento de permanecer abierto. Un error conserva el borrador
y permite actualizar el historial sin volver a publicar automáticamente.

La operación se denomina Publicar revisión en lugar de los modos Guardar del
ABM de Obras Sociales: cada envío es una revisión nueva, no una actualización.
Los recibos guardados conservan sus valores hasta una adopción explícita.
Se mantiene el comportamiento funcional del modal actual; esta tarea agrega
un acceso independiente, sin migrar otras funciones legacy.

## Validación

Pruebas del menú: `npm test -- src/layouts/AppShell.test.tsx`.
Pruebas de navegador: `npx playwright test e2e/seguros.spec.ts`, en escritorio,
tablet y móvil, con respuestas HTTP simuladas. Cubren el acceso existente,
publicación desde la nueva pantalla, copia sin motivo, validación del motivo,
conflicto 409 con conservación del borrador, actualización del historial y
consulta sin acciones de escritura para un usuario no SuperAdmin.
Se generan capturas de grilla y formulario y se verifica accesibilidad del modal.
La compilación incluye TypeScript; se comprueba formato con Prettier.
Estas verificaciones no ejecutan persistencia contra una base de datos real.
