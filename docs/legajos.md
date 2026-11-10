# Legajos: migración y revisión

La pantalla `/app/legajos` reutiliza los patrones de Empresa y Fórmulas: campos compactos con etiqueta a la izquierda, selectores estilizados, detalles con datos a la izquierda y acciones a la derecha, consulta y los tres modos de guardado.

Incluye datos personales, empresa/actividad, datos laborales, conceptos particulares y SICOSS. Los conceptos se editan en un borrador y se guardan junto al legajo en una transacción. Quitar un concepto persistido requiere su identificación explícita; omitirlo del request no lo elimina. Se preservan valores nulos, precisión decimal y fechas sin cambios.

## API

- GET `/api/legajos/{id}/completo`: legajo, conceptos, antigüedad y situación de revista actual.
- POST `/api/legajos/completo`: alta completa.
- PUT `/api/legajos/{id}/completo`: actualización completa.
- GET `/api/legajos/catalogos/{tipo}?padreId=...`: opciones de entidades relacionadas.

Las mismas operaciones están disponibles bajo el alias `/api/v1/catalogos/legajos`. Se reutilizan `legajo:read`, `legajo:write` y la autorización central de SuperAdmin. Los catálogos dependientes validan empresa/actividad y convenio/categoría/fórmula en backend.

No se modificó el legacy ni se requiere una modificación de esquema. Las pruebas HTTP usan persistencia de prueba; no reemplazan una validación contra la base del cliente.

## Selectores compartidos

Actividades y bancos de Empresa, períodos y tipos de liquidación de Fórmulas y conceptos de Legajos utilizan búsqueda y un botón para limpiarla. Cambiar el filtro no descarta las filas ya seleccionadas. Los filtros locales admiten diferencias de mayúsculas y acentos; Bancos conserva la búsqueda del servidor.

## Verificación de esta entrega (2026-10-11)

- Compilación de backend Release y frontend TypeScript/Vite.
- 426 pruebas unitarias de backend aprobadas.
- 18 pruebas Playwright aprobadas entre escritorio, tablet y móvil: Legajos, selectores de Empresa y Fórmulas, y corrección inicial de Convenios. Se revisaron capturas.
- Vitest no inició su worker en este entorno; sus pruebas no se consideran aprobadas.
- La tanda HTTP conjunta no finalizó y fue interrumpida; se verificaron separadamente los casos afectados. No se ejecutaron operaciones contra la base del cliente.
- Verificación HTTP final: 5 pruebas aprobadas (Legajos completo y corrección inicial, incluido el campo escalaInicial en el contrato HTTP).
