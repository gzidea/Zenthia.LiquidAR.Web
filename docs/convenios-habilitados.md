# Convenios habilitados del cliente

Ruta protegida y lazy: `/app/convenios-habilitados`. Menú principal después de
Empresas, visible según capacidades de lectura de configuración de fórmulas.
No depende del selector superior de empresas. El alcance es el TenantId de la
sesión autenticada y se comparte entre todas sus empresas. Se retiró la pestaña
del modal Fórmulas y recibo y el antiguo submenú de Empresas.

## Comportamiento

La grilla principal lista solo asociaciones existentes, habilitadas o
deshabilitadas. Agregar abre Modal con DataGrid del catálogo completo aún no
asociado; permite búsqueda local sobre ese catálogo, selección múltiple y
paginación. La selección se conserva al buscar y paginar. El alta es única,
transaccional y habilita todos los seleccionados. Un error mantiene selección y
modal. La escritura bloquea el cierre y evita envíos duplicados.

Deshabilitar cambia el estado sin borrar la asociación; Habilitar reutiliza la
misma fila. Un convenio deshabilitado no vuelve a aparecer en el modal Agregar.
No hay eliminación, selección de tenant ni cargas por empresa.

Se reutilizan DataGrid, Modal, controles y estilos existentes, filas de 48px,
25 registros iniciales y tamaños 10/25/50/100, con selector de columnas, refresco,
skeleton, errores y vacío. Los datos remotos pertenecen a React Query y la
invalidación alcanza las consultas de fórmulas que dependen de estos convenios.

## Contrato y seguridad

- GET `/api/configuracion/convenios-habilitados`: catálogo completo con `id`,
  `nombre`, `habilitado` y el nuevo `agregado`, que distingue ausencia y baja lógica.
- POST en esa misma ruta: `{ convenios: [id, ...] }`, de 1 a 1000 IDs distintos.
  Valida todo antes de escribir; devuelve conflicto si alguno ya fue agregado.
- PUT `/api/configuracion/convenios-habilitados/{id}`: `{ habilitado: boolean }`.

Conserva FormulasEmpresaPolicies y las capacidades existentes: SuperAdmin,
TenantAdmin o permiso exacto `formulas:write` para escritura; lectura también
admite `formulas:read`. El tenant lo deriva el backend de la identidad; ningún
payload o selector concede privilegios. Se exige tenant positivo y el flag
FormulasEmpresa:Enabled. Los endpoints por empresa existentes conservan su
contrato y siguen resolviendo el tenant propietario, aunque la web ya no los
utiliza para esta administración.

## Migración y compatibilidad

Aplicar `LiquidAR.Net10/docs/sql/multitenancy/05_convenios_estado.sql` después
de 03/04, con respaldo verificado y escritores anteriores detenidos. Agrega
`TenantConvenios.Habilitado boolean NOT NULL DEFAULT true`, conservando las
asociaciones previas habilitadas. La API comprueba la columna al iniciar con
fórmulas empresariales activadas. No se reconstruyen asociaciones borradas por
versiones anteriores, porque no hay evidencia suficiente para recuperarlas.

Cambió la baja física por baja lógica y se adaptaron todas las consultas de
habilitación para no usar los convenios deshabilitados como si siguieran activos.
No modifica recibos guardados ni elimina fórmulas o asociaciones históricas.
El catálogo completo sigue disponible en GET; `agregado` permite presentar la
lista solicitada sin inferir estados ni guardarlos en localStorage.

Las pruebas de navegador usan API simulada. El script debe aplicarse en la base
del entorno antes de desplegar esta versión; no se debe reiniciar la API con
FormulasEmpresa:Enabled hasta preparar esa columna.
