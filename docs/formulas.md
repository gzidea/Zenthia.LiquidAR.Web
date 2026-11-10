# Fórmulas

Revisión visual 11/10/2026: períodos y tipos de liquidación usan el mismo patrón de filas que bancos/actividades de Empresa: borde completo, datos y Aplicar agrupados a la izquierda, Quitar a la derecha, botones compactos y Agregar alineado a la derecha. Conservan la misma adaptación en tablet y móvil.

Verificación de la revisión: build y formato aprobados; Playwright: 7 escenarios aprobados y 2 omisiones intencionales del caso de permisos fuera de escritorio. Capturas revisadas en los tres tamaños, disponibles en `artifacts/formulas-review`. Vitest continúa pendiente por timeout al iniciar el worker, antes de ejecutar las pruebas del schema; no se consideran aprobadas.

Ruta `/app/formulas`, disponible con `formulas:read`. Escrituras con `formulas:write`; eliminación de fórmulas/asociaciones persistidas con `formulas:delete`. Se reutiliza el criterio central de SuperAdmin.

La pantalla conserva las agrupaciones funcionales de `FormulaEditForm.vb`, controles compactos y etiquetas izquierdas de Obras Sociales, y multiselección de detalles de Empresas. Los períodos representan meses del año; las fechas de vigencia son campos distintos incorporados desde el contrato actual.

El listado consulta filtros y paginación en el servidor. La exportación XLSX incluye todas las coincidencias. Los catálogos de convenios/conceptos se obtienen recorriendo todas sus páginas; no se presenta una búsqueda de la primera página como búsqueda global. Sin permisos de catálogo se preservan los IDs existentes y se informa qué selección no está disponible.

El borrador guarda padre e hijos con `/formulas/completa` y `/{id}/completa`. Se envían únicamente campos de escritura, asociaciones nuevas/modificadas y bajas explícitas. Aplicar corresponde a Seleccionado; desmarcar no elimina. Nuevas opciones agregadas se marcan Aplicar. Una lista vacía no significa todos.

Guardar mantiene el ID recibido; Guardar y nuevo abre un alta limpia; Guardar y cerrar sólo cierra ante éxito; Deshacer consulta nuevamente el persistido; Cancelar no escribe. La consulta no permite envíos. Se bloquean cierres y acciones incompatibles durante escrituras.

Las expresiones se conservan literalmente. Base es editable si Cantidad no está vacía e Importe está vacío; Importe si Base está vacía. No se borran valores por deshabilitar controles. Cargar como novedad conserva null/false/true. Fechas sin conversión de zona horaria.

Duplicar copia escalares incluida Base, sin asociaciones. Guardar y clonar guarda el original y crea una copia con asociaciones, sin Base, como el legacy; la nueva ruta hace ambas operaciones atómicas.

El editor asistido de variables queda como etapa posterior. No se agregaron dependencias ni SQL para esta pantalla.

Pruebas: `npm test -- src/features/formulas --maxWorkers=1 --pool=threads`, `npm run build`, `npm run test:browser -- e2e/formulas.spec.ts --workers=1`. Los escenarios de navegador usan API simulada, sin escribir datos del cliente.
