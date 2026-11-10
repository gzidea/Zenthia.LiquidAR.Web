# Organizar orden de fórmulas

En Fórmulas, seleccionar un convenio para habilitar **Organizar orden** (requiere permisos de lectura y escritura de fórmulas). Se abre una lista completa con Código, Descripción, Variable, Estado y posición, incluidas las fórmulas inactivas. La búsqueda y el filtro de estado del listado se conservan, pero no ocultan filas del organizador. El diálogo impide cambiar de convenio mientras se organiza.

Arrastrar desde ↕ o utilizar Subir/Bajar, accesibles con teclado y en móvil. La nueva posición determina el campo Orden: 1..N. **Guardar orden** envía el conjunto en una operación y actualiza los listados y detalles en caché. **Cancelar** pide confirmar el descarte si hay cambios. Una carga fallida permite reintentar; un guardado fallido conserva el borrador. Ante un conflicto de versión, cancelar y reabrir para cargar el estado actual. Durante el guardado se bloquean movimientos, cierre y envíos duplicados. El borrador no se reemplaza automáticamente al volver a la ventana o recuperar conexión.

Se utiliza `FormulaOrderDialog`, hooks de React Query y `formulaService` sobre ApiClient. Los cambios están limitados a Fórmulas y no agregan funcionalidades de reordenamiento al DataGrid global ni dependencias nuevas. Backend y contrato: `LiquidAR.Net10/docs/migracion/Formulas-Orden.md`.
