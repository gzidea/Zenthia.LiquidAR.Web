# Recibo público de demostración

Ruta `/demo/recibo`, fuera de Gate y sin SessionLifecycle mientras se visita esa ruta. No requiere login ni modifica la sesión del visitante. El enlace Ingresar conserva el recorrido privado existente.

Feature `src/features/recibo-demo`: formulario React Hook Form/Zod, consultas React Query, servicio sobre ApiClient, recibo HTML y estilos aislados. El único origen del resultado es el motor del backend; no hay fórmulas de liquidación en React. El gráfico es presentación de los grupos calculados. Sin localStorage/sessionStorage ni estado global persistido.

La carga inicial selecciona el primer convenio/categoría disponible para mostrar un ejemplo y sugiere el mes actual. El visitante puede elegir cualquier período mensual válido, incluso futuro, para simular cambios programados. Período, convenio y categoría determinan las escalas y fórmulas aplicables desde BD; si falta una configuración vigente, la API informa que el escenario no se puede calcular. La antigüedad mantiene como referencia la fecha actual del servidor y no se proyecta al período elegido. Cambiar convenio limpia la categoría y exige elegir una del nuevo convenio. Los cambios válidos recalculan tras 450 ms; los requests usan AbortSignal y claves por entrada. Se ocultan resultados anteriores mientras se cambia o recalcula, evitando mostrarlos como actualizados. Los catálogos vacíos, fallos de acceso y dependencias faltantes se muestran expresamente.

Contrato y activación: `LiquidAR.Net10/docs/migracion/Recibo-Demo.md`. La cuenta interna, sus tokens y las expresiones de fórmulas nunca llegan a React. La demo puede abrirse aunque falle Security; sus operaciones mostrarán indisponibilidad si no se puede autorizar la lectura interna.

El diseño mantiene el tema actual alrededor de un recibo blanco inspirado en xrReciboA4.repx. En móvil los controles se apilan y la tabla del recibo admite desplazamiento horizontal sin desbordar la página. No se agrega exportación PDF ni persistencia.

Validación prevista/automatizada en `ReciboDemoPage.test.tsx` y `e2e/recibo-demo.spec.ts`. Los fixtures de pruebas son sintéticos; no prueban el acceso a catálogos reales.

