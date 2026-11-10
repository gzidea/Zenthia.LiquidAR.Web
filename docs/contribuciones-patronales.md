# Contribuciones patronales

En Reglas de ajuste están disponibles **Fijar importe final** (sustituye el original por recibo) y **Fijar importe mensual (por diferencias)** (objetivo mensual menos lo liquidado en otros recibos de la misma obligación, empresa, legajo y período). Ajuste de importe fijo conserva su comportamiento de sumar/restar. Todos conservan cuatro decimales en el payload.

Para una cuota mensual: elegir la fórmula real de columna 4, indicar cuota, vigencia y fuente en el motivo; publicar los cambios como revisiones de la misma regla. Generar el mensual primero y después las complementarias. Una cuota oficial publicada de INACAP se carga de esta forma, independientemente de la categoría del trabajador. Las alícuotas continúan utilizando base explícita y el orden de fórmulas.

El cálculo ordinario conserva la asignación mensual ya aprobada. Cambiar/rebalancear exige previsualizar y adoptar reglas; si cambian otros recibos, la huella de confirmación se invalida. Los recibos previos sin auditoría mensual requieren revisión antes de generar diferencias. La demo utiliza saldo sintético cero, sin afectar recibos reales.

En Empresas, **Costos de póliza** permite consultar y publicar cargos de emisión/renovación SCVO por empresa/póliza/período. La revisión esperada evita sobrescrituras; se conserva historial y se suma solo la última revisión de cada cargo. Importe cero anula mediante una nueva revisión. Los cargos son propios de empresa y no se distribuyen por empleado ni se agregan al gráfico individual.

Flujo: página/diálogo → hooks React Query → EmpresaService → ApiClient. Reutiliza Modal, Input, Select, Skeleton y mensajes normalizados. Lectura `empresas:read`, publicación `empresas:write`; la seguridad efectiva y SuperAdmin se resuelven en backend. Las reglas conservan sus permisos de fórmulas. No hay dependencias ni mecanismos de sesión nuevos.

El historial de pólizas usa publicaciones inmutables, por lo que la acción es Publicar cargo y mantiene abierto el diálogo tras el éxito. Los errores conservan los campos y permiten actualizar historial. No hay edición destructiva ni eliminación de revisiones. El historial permite desplazamiento con teclado en pantallas pequeñas.

Antes del despliegue del backend debe aplicarse manualmente `LiquidAR.Net10/docs/sql/propuestas/11_Contribuciones_Patronales.sql` (requiere 03 y 05). Consultar `LiquidAR.Net10/docs/migracion/Contribuciones-Patronales.md` para los contratos, decisiones y configuración pendiente. No se cargaron tasas, cuotas ni asociaciones del catálogo por suposición.
