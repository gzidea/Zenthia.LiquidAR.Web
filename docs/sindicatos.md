# Sindicatos: referencia ABM

## Comportamiento actual de los diálogos

Por pedido del usuario, Obras Sociales es ahora la referencia de interfaz.
Sindicatos utiliza `FormDialogActions` compartido con ese módulo:
Guardar conserva el diálogo editando el ID devuelto por la API; Guardar y cerrar
cierra tras éxito; Guardar y nuevo inicia un alta limpia; Deshacer limpia el alta
o recarga el detalle en edición. Se conserva una única validación y mutation de
guardado. Los campos, botones y cierre se bloquean durante el envío y un error
conserva el borrador. Cancelar descarta cambios locales sin enviar una escritura.

El detalle devuelto por el servidor actualiza su caché y se invalidan los listados;
el segundo guardado de un registro creado realiza PUT, sin duplicar el alta.
La grilla incorpora Refrescar y se muestran mensajes de éxito al guardar/eliminar.
Consulta continúa siendo readonly con Cerrar. Los contratos, campos, permisos
y columnas propias de Sindicatos se mantienen. Esta sección reemplaza las
descripciones históricas inferiores que indican que Guardar siempre cierra.

Validación de esta actualización: 63 pruebas de Sindicatos, Obras Sociales y
Modal aprobadas; 12 escenarios Playwright aprobados en escritorio, tablet y móvil
con API simulada, incluidos modos de guardado, skeleton, bordes y Axe. Build,
TypeScript y Prettier aprobados. Los archivos AGENTS.md no se modificaron.

## Estados de carga con Skeleton

La consulta de permisos muestra `DataGridSkeleton` sin controles interactivos.
El listado utiliza la integración de carga inicial del DataGrid. Alta y edición
muestran `SindicatoFormSkeleton`, una composición de bloques `Skeleton` compartidos
que reutiliza las clases de distribución del formulario real (13 campos, filas
compactas y grupo de aportes). Mantiene el ancho de 755 px del modal, limitado al
viewport, y controles decorativos de 28 px en escritorio y 36 px en móvil.

Durante esa carga se conserva el título conocido, Cancelar y el cierre del modal;
Guardar permanece deshabilitado. Los errores reemplazan el skeleton y ofrecen el
reintento existente. Guardar/eliminar conservan su indicador de operación en curso;
Ver ya dispone de los datos de la fila y no simula una carga inexistente.
No cambian consultas, permisos, contratos ni reglas del formulario.

El borde superior de los encabezados del DataGrid y de su skeleton independiente
usa `1px solid var(--rule)`, igual que el borde inferior. Es una corrección visual
compartida, tanto durante la carga como al mostrar datos.

Validación de esta integración: 56 tests aprobados con
`npm.cmd test -- src/features/sindicatos src/components/ui/DataGrid src/components/ui/Skeleton --maxWorkers=1`;
flujos ABM y pruebas de carga/bordes/estabilidad aprobados en Chrome desktop,
tablet y mobile (APIs simuladas). Build, TypeScript y Prettier aprobados.
Se corrigió una diferencia de 42 px entre skeleton y formulario reutilizando
su margen y separación de grupos. Los timeouts de arranque de workers se
resolvieron ejecutando Vitest con un worker; las pruebas de navegador esperan
la ruta lazy y liberan las respuestas antes de ejecutar Axe para no agotar el
timeout HTTP. Se revisaron capturas del listado y del modal; los bordes se
comparan por ancho, estilo y color antes y después de cargar los datos.

**Actualización de autenticación:** LiquidAR ahora recibe el access token como Bearer, conservado en memoria tras login. Esto reemplaza el pendiente de conversión cookie/Bearer mediante gateway descrito en el historial de esta página. Ver [Tokens para LiquidAR](tokens-liquidar.md). La provisión de permisos y la configuración JWT/CORS del microservicio siguen siendo responsabilidad del backend.

Ruta protegida: /app/sindicatos. Page → hooks React Query → SindicatoService → ApiClient → /api/sindicatos. DataGrid y Modal no conocen HTTP. SindicatoForm comparte alta/edición, React Hook Form y Zod.

## Contrato

Visualización utiliza el mismo SindicatoForm y layout que alta/edición, con readOnly en todos los inputs (incluida la provincia como texto copiable), envío del formulario bloqueado y únicamente Cerrar en el Modal.

El formulario de alta/edición reproduce la distribución de LayoutControl1 de SindicatoEditForm.Designer.vb: código corto, nombre y dirección a todo el ancho, localidad/código postal, provincia corta, email/teléfono y grupo inferior con porcentajes a la izquierda, importes a la derecha y base de cálculo debajo. Etiquetas laterales y entradas compactas; en móvil se apilan para mantener legibilidad. Solo se toma esa zona de entradas del legacy: no se replica Ribbon ni barra de estado/footer; las acciones del Modal web permanecen. Se conservan theme, controles compartidos, validación y contratos.

Presentación actual: Nuevo dentro del toolbar del DataGrid, selección múltiple por página con contador, filas de 48px, tamaños 10/25/50/100 (inicio 25) y acciones Ver/Editar/Eliminar según permisos. Ver presenta los datos de la fila en el Modal compartido, sin habilitar escritura. La barra muestra búsqueda y filtros deshabilitados con explicación, dado que la API no admite esos parámetros; no hay sorting remoto ni acciones masivas ficticias. Esto reemplaza la presentación anterior con Agregar fuera de la grilla y controles ocultos.

La consulta del selector de provincias utiliza GET /api/provincias, según la ruta confirmada por el usuario. El endpoint de tablas maestras devuelve id/codigo/nombre; el selector utiliza id y nombre. Esta ruta exige Permission.Auxiliar.Read, a diferencia del endpoint anidado anterior que exigía sindicatos:read.

GET raíz usa page (desde 1) y pageSize (1–100), devuelve items/page/pageSize/total. Primera carga 25; opciones 25/50/100. GET /{id} carga edición, GET /provincias devuelve id/nombre. POST raíz crea, PUT /{id} reemplaza todos los campos editables, DELETE /{id} elimina físicamente y responde 204 también si ya no existe.

Sin búsqueda, filtros ni orden configurable en backend. Grilla con esas funciones ocultas/desactivadas; columnas, tamaños y resize siguen disponibles. No se filtra solamente la página recibida. showSearch y showFilterButton son nuevas opciones genéricas con valor predeterminado true.

Campos editables nullable. Código, email, teléfono y base de cálculo: máximo 255. No se inventan obligatoriedad ni formato email. Enteros Int32, porcentajes finitos, importes enviados como cadenas invariantes con precisión decimal(19,4); sin conversión a Number. Provincia inexistente en lookup se conserva al editar. PUT conserva cadenas vacías existentes y no incorpora id/tenant/application al body.

## Sesión y permisos

GET /api/users/me de Security devuelve actor con userId, tenantId, applicationId, isSuperAdmin y permissions. Se consulta solo después del login, sin restaurar sesión ni leer tokens. El perfil se valida con Zod y se comprueba userId. La caché se reemplaza y cancela al cambiar revisión de sesión.

Lectura sindicatos:read; alta/edición sindicatos:write; baja sindicatos:delete. El backend actual admite SuperAdmin sin permiso explícito, pero exige igualmente tenant/application configurados. La UI refleja el permiso/superadmin y el servidor mantiene la autorización efectiva del contexto. La documentación antigua del backend que dice que SuperAdmin no omite permisos difiere del CatalogAuthorization actual; se siguió el código actual.

La provisión real de write/delete en Security no está verificada. No se modifica Security ni se crean permisos. Ante perfil fallido se ocultan acciones y se permite reintentar.

## Integración pendiente

SindicatoService utiliza VITE_LIQUIDAR_BASE_URL (por defecto /api), independiente de VITE_SECURITY_BASE_URL. Para usar un microservicio local se puede configurar su URL absoluta incluyendo /api. Las llamadas entre orígenes requieren CORS con credenciales. La separación de URLs no resuelve el traslado de autenticación por cookie al Bearer que espera LiquidAR; no se encontró esa configuración en el workspace y no se implementa un mecanismo alternativo de tokens. Las pruebas simuladas no validan gateway, BD ni permisos provisionados.

React Query es la única dependencia directa nueva requerida por el prompt. UI nativa y theme existente. Reintentos de mutaciones desactivados; conflictos mantienen el modal abierto. Tras éxito se invalida el listado y se cierra; una última página vacía retrocede al último índice válido.

## Validación

Tests de contrato/servicio, permisos, página y formulario integrado; Playwright recorre alta/edición/baja en desktop/tablet/mobile con API simulada y axe. Los resultados de ejecución se informan en la entrega. No hay script de lint. La suite completa tiene seis fallos previos en config.test.ts ligados a la configuración pública existente, fuera de esta tarea.

## Revisión de continuidad

Se conservaron la feature, contratos y componentes existentes. La revisión detectó que reabrir edición podía inicializar el formulario desde un detalle obsoleto en caché. Ahora se espera la reconsulta antes de montar el formulario; el detalle no se recarga automáticamente al recuperar foco/conexión para no reemplazar el borrador. Se agregó una regresión que simula una modificación externa entre aperturas.

Validaciones acumuladas: build y TypeScript correctos; Prettier sobre archivos modificados; 121 tests aprobados excluyendo únicamente config.test.ts, con cobertura de líneas 91,95% y ramas 90,73% en esa ejecución. Una prueba adicional de errores del formulario pasó por separado. Sindicatos y DataGrid pasaron los recorridos de navegador en desktop/tablet/mobile, y Modal pasó sus 12 casos. Los tests antiguos de autenticación fueron actualizados para permitir /users/me después del login manteniendo la prohibición de restauración automática al recargar. Los resultados finales de la reconsulta y de autenticación se informan en la entrega.

No se consultó ni modificó el legacy: el contrato backend resolvió el alcance funcional. No se modificaron backend, Security, base de datos, AGENTS ni almacenamiento de credenciales. La verificación real de gateway y provisión de permisos sigue pendiente.

Resultado final de continuidad: los 6 tests de la página (incluida reapertura con detalle actualizado) y los otros 4 tests de Sindicatos pasaron. La primera ejecución de página sufrió timeout al iniciar el worker de Vitest; la repetición aislada pasó. Build/TypeScript y Prettier pasaron. Autenticación pasó en tablet/mobile y, tras ampliar a 60 segundos el escenario con múltiples capturas/axe, también en desktop. El ABM de escritorio volvió a pasar después de corregir la reconsulta. No se repitió cobertura global tras esta corrección; los porcentajes anteriores corresponden a la ejecución indicada.
