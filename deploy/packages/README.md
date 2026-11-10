# Paquetes compartidos de LiquidAR Web

Copias exactas de los artefactos ya fijados en `package-lock.json`, producidos por
`Zenthia.Frontend.Shared/artifacts`:

| Paquete              | Versión | Archivo                       |
| -------------------- | ------- | ----------------------------- |
| `@zenthia/app-shell` | 0.1.1   | `zenthia-app-shell-0.1.1.tgz` |
| `@zenthia/ui`        | 0.1.2   | `zenthia-ui-0.1.2.tgz`        |

Versionar ambos `.tgz` junto con los fuentes de LiquidAR. El Dockerfile los coloca en
`/workspace/Zenthia.Frontend.Shared/artifacts` para respetar las rutas relativas del
lockfile. `npm ci` comprueba su integridad. No necesita clonar Shared ni Administrar.

Se conserva la versión de app-shell de LiquidAR, que es distinta de la de Administrar;
no se incorpora security-client ni se reemplaza el flujo de autenticación existente.
La imagen final sirve el bundle compilado, sin Node ni dependencias de ejecución con
las otras aplicaciones.

Para actualizar, cambiar y empaquetar primero en Shared, versionar la dependencia,
actualizar el lockfile de LiquidAR y copiar el nuevo tarball aquí. No sustituir el
contenido de un paquete manteniendo su versión. Cada aplicación adopta y despliega
las versiones de forma independiente.
