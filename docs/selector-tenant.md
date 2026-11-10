# Selector de contexto de tenant

El superusuario dispone de un selector a la izquierda del selector de empresa.
Permite buscar por nombre o ID y elegir un tenant activo o volver a **Todos los
tenants**. En pantallas pequeñas ambos selectores se apilan en ese orden.
La selección vive en memoria durante el login; una renovación la conserva y
un nuevo login o logout la elimina. No modifica tokens, roles ni permisos.

## Contrato y autoridad

- LiquidAR expone `GET /api/contexto/tenants`, exclusivo de `super=true`.
- Consume únicamente el contrato existente `GET /api/tenants` de Security,
  con el bearer del solicitante. Devuelve solo `{ id, name }` de tenants activos.
- La web envía `X-LiquidAR-Tenant-Id: <entero positivo>` en solicitudes
  autenticadas a LiquidAR. No lo envía a Security ni al catálogo del selector.
- Cada solicitud con ese encabezado valida autenticación, superusuario,
  aislamiento multitenant habilitado y presencia del tenant en el listado activo
  de Security. Si Security falla, devuelve 503 y no continúa con acceso global.
  Un encabezado inválido devuelve 400; un usuario sin privilegio o un tenant
  inexistente/inactivo devuelve 403. Sin aislamiento devuelve 409.
- La dirección del servicio es `Security:BaseUrl`, con compatibilidad con la
  dirección ya configurada en `ReciboDemo:Security:BaseUrl`. Debe ser HTTPS
  (HTTP solo en loopback). No se siguen redirecciones ni se almacenan cookies.

No se agregaron endpoints, permisos o claims al microservicio Security.
Los nombres del encabezado y del endpoint de contexto son contratos locales
de LiquidAR. El selector no comprueba suscripciones adicionales: su catálogo
es exactamente el de tenants activos autorizado por Security.

## Alcance de los datos

El actor conserva `IsSuperAdmin`, roles y permisos; su `TenantId` efectivo se
resuelve en LiquidAR con `SelectedTenantId`. El principal autenticado original
permanece intacto. El acceso global a datos privados se desactiva durante esa
selección. Las empresas, legajos, recibos y configuraciones privadas usan los
filtros y controles de escritura existentes. Las operaciones de fórmulas por
empresa comprueban también el tenant frente a IDs suministrados directamente.

Los catálogos compartidos, las fórmulas centrales y las acciones de mantenimiento
central del superusuario conservan su alcance y sus permisos. El catálogo general
de convenios sigue siendo compartido; **Convenios habilitados** administra las
asociaciones del tenant elegido. Para esa configuración se exige una selección
explícita al superusuario, evitando escribir en su tenant de origen por defecto.
Las rutas históricas que identifican una empresa siguen resolviendo su propietario.

Cambiar el tenant limpia la empresa seleccionada y remonta las consultas con
un QueryClient nuevo, cancelando y eliminando la caché anterior. El cliente HTTP
descarta las respuestas tardías del contexto anterior sin cerrar la sesión.
Durante mutaciones o ediciones que bloquean la selección no se permite cambiar
de tenant; los modales deben cerrarse primero. Novedades bloquea la selección
mientras tiene cambios sin guardar.

## Validación y despliegue

Se agregaron pruebas del middleware, catálogo HTTP, filtrado SQL, controles de
escritura, estado del selector, envío del encabezado y descarte de respuestas
tardías. Las pruebas de navegador utilizan API simulada.
La prueba PostgreSQL requiere `MULTITENANCY_TEST_DATABASE` y su base descartable.
Este cambio no agrega columnas ni requiere una nueva migración. Requiere el
esquema multitenant y sus migraciones previas ya preparados para el entorno.
