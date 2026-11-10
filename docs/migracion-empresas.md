# Empresas

Ruta: `/app/empresas`. Referencia funcional: `EmpresaEditForm.vb` y su contenedor `Root`. Referencia visual: Obras Sociales y las capturas aprobadas por el usuario.

El formulario conserva las filas Código/Nombre, Dirección, Localidad/Provincia, Teléfono/Email, Tipo de clave/Clave única/Tipo de empresa AFIP. Usa etiquetas laterales y controles compactos, incluidos los selectores. Código postal se conserva al editar pero no se incorpora al Root, donde no era editable.

Las pestañas son Actividades, Contactos y Bancos. Actividades y Bancos permiten seleccionar varias opciones y conservar la selección al cambiar de página o búsqueda. Los detalles se editan en el borrador: datos a la izquierda y acciones a la derecha; Activo pertenece a los datos. Las nuevas asociaciones comienzan inactivas y ValorSeguro en cero, como los valores iniciales del modelo legacy. Seleccionar una opción no la activa. Se evitan nuevos duplicados desde el selector, sin alterar duplicados históricos.

Guardar permanece en edición con el ID devuelto; Guardar y nuevo abre un alta limpia; Guardar y cerrar cierra tras el éxito. Deshacer reinicia el alta o consulta nuevamente el detalle guardado. Cancelar no escribe. Los errores conservan el borrador y durante un guardado se bloquean campos, acciones de guardado y cierre.

El guardado completo usa POST `/api/empresas/completa` o PUT `/api/empresas/{id}/completa`; GET de la misma ruta recupera empresa y detalles. Se envían altas, cambios y bajas explícitas de detalles. Omitir una fila no la elimina. El backend confirma todo en una transacción. ValorSeguro viaja como texto decimal para no perder precisión.

Se reutilizan permisos empresas:read/write/delete. Eliminar detalles guardados requiere delete además de write. Catálogos auxiliares requieren auxiliar:read; bancos requiere bancos:read. Sin acceso a auxiliares se conservan los IDs actuales y se permite editar los demás datos. El acceso real lo determina el backend con la política centralizada de SuperAdmin.

El listado de empresas no ofrece búsqueda remota inexistente. El selector de bancos usa la nueva búsqueda del backend por código, denominación y abreviación; actividades filtra el catálogo completo recibido.

No requiere nuevas tablas, SQL ni paquetes. Las pruebas usan datos simulados y no escriben en una base real. La comprobación visual debe incluir escritorio, tablet y móvil, controles, filas de detalles y skeleton.

## Navbar y empresa global — 28 de octubre de 2026

La barra superior incluye un icono lateral sin acción, selector de empresa con búsqueda,
avatar con iniciales del perfil y el icono de salida dentro del botón de logout existente.
Se conserva el botón Menú funcional en móvil. El avatar todavía no abre un menú.

El selector consume GET /api/empresas/selector (también disponible en el alias
/api/v1/catalogos/empresas/selector). Parámetros: page=1, pageSize=25 (máximo 100),
buscar opcional (máximo 100 caracteres). Respuesta: items, page, pageSize, total;
cada item incluye id, codigo, nombre y claveUnica. Busca nombre sin distinguir
mayúsculas, código numérico exacto o fragmento de CUIT, antes de paginar. Ordena
por nombre e ID. Requiere empresas:read; super=true utiliza la autorización global
existente. Sin ese permiso el control queda deshabilitado. No se amplían permisos.
El servicio establece ActorContext en UnitOfWork y el repositorio conserva los
filtros multitenant de EF: tenant propio o acceso global para SuperAdmin.

React Query mantiene datos remotos; Zustand mantiene exclusivamente el ID:
`useEmpresaContextStore(s => s.empresaSeleccionadaId)`.
Las acciones son `seleccionar(id)` y `limpiar()`. Comienza en null y no se persiste.
Se conserva al navegar y renovar sesión; cambia a null al iniciar otra sesión,
cerrar sesión o cambiar la revisión de autenticación. Recargar reinicia la selección.
No cambia TenantId ni aplica todavía filtros a los módulos existentes.

No modifica Security, credenciales, JWT, tablas ni datos. Es una funcionalidad nueva
solicitada para la interfaz web, sin modificar reglas funcionales del legacy.
Para usar el selector debe publicarse/reiniciarse la API con la nueva ruta además
de actualizar el frontend. No se reinicia el proceso del usuario automáticamente.

Validación: build de API sin errores/advertencias; 41 pruebas unitarias de Empresas
(incluida traducción SQL de búsqueda, paginación y filtro tenant), 1 prueba HTTP
del selector (401, 403, permiso válido, SuperAdmin y validación), 8 pruebas frontend
(store, navbar, falta de permiso, vacío y reintento). Build frontend/TypeScript correctos.
Playwright: búsqueda remota, paginación, selección, iniciales, Escape y logout desde
el icono en escritorio/tablet/móvil; revisión visual y axe sin violaciones.
Las pruebas HTTP usan persistencia simulada y las SQL inspeccionan traducción sin
conectarse: no se ejecutó esta consulta contra datos reales ni se reinició la API.
La corrida amplia de HTTP y rutas frontend se interrumpió al demorarse; los resultados
anteriores corresponden únicamente a las suites específicas completadas.

## Seguros SCVO / ART y valores oficiales

El campo Valor del seguro dejó de editarse en Actividades. La configuración se realiza
con Valores SCVO / FFEP en la toolbar de Empresas, Seguros SCVO / ART por fila de empresa
y Cobertura SCVO por fila de Legajos. Cada pantalla conserva historial, publica revisiones
con vigencia y motivo, mantiene el borrador ante errores y respeta sus permisos existentes.
Los valores centrales son consultables; su publicación requiere super=true.

Las fórmulas disponen de SCVO_PRIMA, SCVO_APLICA, SCVO_CUOTA, ART_ALICUOTA, ART_FIJO y
FFEP_CUOTA. ISEGURO representa la cuota SCVO resuelta. En Reglas de ajuste, Fijar importe
mensual permite elegir fuente SCVO, FFEP o fijo ART en lugar de un objetivo manual.

Requiere desplegar el backend y aplicar el script 14 antes de usar esta versión.
La fuente de verdad de vigencias, contratos, snapshots y despliegue es
LiquidAR.Net10/docs/migracion/Seguros-SCVO-ART.md. No se cargaron valores reales.

## Configuración de Fórmulas fuera de la grilla de Empresas (2026-11-01)

La acción «Fórmulas y recibo» se trasladó a Empresas → Configuración de Fórmulas,
ruta lazy `/app/empresas/configuracion-formulas`. Reutiliza las tres secciones
Agrupaciones, Fórmulas propias y Exclusiones y sus editores RHF/Zod, mutations
e invalidación existentes. La empresa procede del selector superior; sin empresa
se muestra una indicación, y al cambiarla se desmontan los datos y editores previos.
El cambio de tenant sigue limpiando empresa y cache mediante QueryProvider.
Mientras hay un editor abierto se bloquea la selección de empresa y tenant.

El grupo padre Empresas ya no exige un permiso propio: aparece si al menos uno
de sus submenús está autorizado. El listado Empresas y los submenús de seguros
conservan sus permisos. Configuración de Fórmulas usa `enabled`, `puedeLeer` y
`puedeEscribir` del backend, incluyendo las reglas existentes para TenantAdmin
y SuperAdmin. La ruta directa aplica el mismo control de capacidades.

Para usuarios sin `empresas:read`, el selector utiliza GET
`/api/configuracion/formulas-empresa/empresas` y GET de `/{id}`, con datos mínimos,
autorización de fórmulas y aislamiento por tenant. La pantalla también utiliza
ese detalle mínimo. El backend general de Empresas conserva sus permisos.
Requiere desplegar ambos proyectos; no hay cambios en Security ni en el esquema.

Las reglas de cálculo, vigencias y presentación de recibos se conservan. Es un
traslado de navegación; no introduce diferencias funcionales respecto del legacy.
Las pruebas HTTP usan persistencia de prueba y las de navegador API simulada;
no representan una validación con cuentas o datos del servidor definitivo.
