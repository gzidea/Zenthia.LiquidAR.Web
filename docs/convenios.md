# Convenios

Feature en `src/features/convenios`, ruta `/app/convenios` y menú con permiso `convenios:read`.

Reutiliza DataGrid, Modal, FormDialogActions, Skeleton, Input, RHF/Zod, React Query y ApiClient. La disposición del Root conserva Código/Nombre y Descripción, seguida por las categorías. Labels, alturas, colores y pie de acciones siguen Obras Sociales. El formulario de categoría es un borrador local; no se guarda por separado al agregarlo.

El alta y edición utilizan `/api/convenios/completo` y `/{id}/completo`. Se envían sólo categorías nuevas o modificadas y bajas explícitas. Los campos derivados de respuesta y montos antiguos no se reenvían. Las escalas iniciales son opcionales y se guardan junto con las categorías nuevas. Los importes conservan cadenas decimales, null y cero.

Guardar conserva el ID; Guardar y nuevo abre otra alta; Guardar y cerrar cierra sólo ante éxito; Deshacer recarga el detalle; Cancelar no envía cambios. Las mutaciones fallidas conservan el borrador. El modo consulta bloquea escrituras y permite ver también los metadatos completos de las categorías.

La acción Escalas del listado abre una consulta independiente: período, importes efectivos, próxima escala, selección múltiple, publicación de finales o porcentajes, comparación previa e historial. Una modificación de la propuesta invalida la previsualización. Publicar utiliza las bases/revisiones de esa previsualización y exige confirmación cuando hay dependencias. Un conflicto obliga a previsualizar otra vez sin borrar el motivo ni los importes ingresados. La anulación mantiene una revisión de auditoría y exige confirmación.

Permisos existentes `convenios:read/write/delete`, respetando SuperAdmin por el mecanismo central. Las categorías con historial no pueden quitarse. El listado remoto no simula búsqueda/filtros sobre una sola página; las categorías locales sí permiten búsqueda sobre el conjunto completo. No modifica otras features ni el cálculo de recibos.

Ver documentación backend `docs/migracion/Convenios.md` para transacciones y requisito de DDL de historial. No hay script SQL nuevo para esta pantalla.

Verificación: tests de contratos/precisión/errores en la feature y casos de navegador en `e2e/convenios.spec.ts`, con datos simulados y capturas de escritorio, tablet y móvil. No se conectan a una base operativa ni usan credenciales reales.

## Corrección de la escala inicial

Desde Convenios → Escalas → Corregir escala inicial, ingresar los importes correctos y un motivo, previsualizar y publicar. Se conserva el período inicial y se crea una revisión sin borrar el historial. Si hay versiones dependientes, confirmar que conservarán sus importes. Los recibos ya guardados no se recalculan. No requiere cambios de base de datos.
