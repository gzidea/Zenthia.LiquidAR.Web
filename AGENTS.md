# AGENTS.md — Frontend React

## 1. Objetivo

Este directorio contiene el frontend web de LiquidAR.

La aplicación debe desarrollarse con:

- React;
- TypeScript;
- Vite.

El objetivo es migrar progresivamente la interfaz funcional existente en el sistema legacy hacia una aplicación web moderna, manteniendo el comportamiento funcional definido por el sistema existente y consumiendo el backend ASP.NET Core/.NET 10.

Las reglas de este archivo aplican específicamente al frontend.

Las reglas generales del proyecto definidas en el `AGENTS.md` raíz también deben respetarse.

---

# 2. Fuentes de verdad

Existen tres referencias diferentes y deben mantenerse separadas.

## 2.1 Legacy

El sistema legacy es la fuente de verdad para:

- funcionalidades;
- comportamiento;
- reglas de negocio;
- validaciones;
- estados;
- permisos funcionales;
- flujos existentes;
- operaciones disponibles.

No asumir que una pantalla representa toda la funcionalidad del módulo.

## 2.2 Backend

El backend ASP.NET Core/.NET 10 es la fuente de verdad para el contrato de comunicación con el frontend:

- endpoints;
- métodos HTTP;
- rutas;
- request;
- response;
- DTOs;
- códigos HTTP;
- errores;
- autenticación;
- autorización.

No duplicar lógica de negocio del backend en React.

## 2.3 liquidar-onboarding

Existe una aplicación denominada:

```text
liquidar-onboarding
```

que se encuentra disponible dentro del entorno del proyecto.

`liquidar-onboarding` debe utilizarse **exclusivamente como referencia visual y de diseño**.

Puede utilizarse para analizar y reutilizar conceptualmente:

- colores;
- tema;
- tipografías;
- tamaños;
- espaciados;
- bordes;
- sombras;
- componentes visuales;
- botones;
- inputs;
- tablas;
- navegación;
- sidebar;
- navbar;
- estados visuales;
- layouts;
- responsive design;
- estilo general de la aplicación.

No utilizar `liquidar-onboarding` como fuente de:

- arquitectura;
- estructura funcional;
- reglas de negocio;
- autenticación;
- autorización;
- modelo de datos;
- contratos API;
- decisiones de estado;
- dependencias;
- organización interna del código;

salvo que una decisión sea explícitamente compatible con este proyecto y esté justificada.

La referencia visual no debe provocar una copia automática de una arquitectura que no corresponda al nuevo frontend.

---

# 3. Arquitectura general

La aplicación debe seguir una arquitectura orientada a features.

Estructura conceptual:

```text
src/
├── app/
├── components/
├── features/
├── hooks/
├── layouts/
├── services/
├── stores/
├── types/
├── utils/
├── lib/
└── styles/
```

La estructura concreta puede evolucionar cuando el proyecto lo requiera.

No crear carpetas o capas únicamente por seguir una estructura teórica.

La organización debe facilitar:

- mantenimiento;
- reutilización;
- testing;
- separación de responsabilidades;
- migración progresiva de módulos.

---

# 4. Stack obligatorio

Utilizar:

- React;
- TypeScript;
- Vite;
- React Router;
- Zustand;
- Axios;
- React Hook Form;
- Zod;
- Vitest;
- React Testing Library.

React Query debe utilizarse cuando exista una necesidad real de manejar datos remotos con:

- cache;
- refetch;
- invalidación;
- estados de loading;
- estados de error;
- sincronización con el servidor.

No utilizar React Query simplemente por estar disponible.

---

# 5. TypeScript

TypeScript es obligatorio.

Evitar:

```typescript
any;
```

salvo que exista una razón técnica concreta y documentada.

Preferir:

- tipos explícitos;
- interfaces;
- type aliases;
- discriminated unions cuando correspondan;
- tipos derivados;
- tipos compartidos.

No duplicar tipos cuando puedan reutilizarse correctamente.

Los contratos de API deben estar tipados.

---

# 6. Vite

Utilizar Vite como herramienta de build y desarrollo.

Configurar alias de imports.

Por ejemplo:

```typescript
@/components
@/hooks
@/services
@/features
@/types
@/stores
```

Preferir imports mediante alias sobre rutas relativas excesivamente profundas.

Ejemplo:

```typescript
import { Button } from "@/components/ui/Button";
```

en lugar de:

```typescript
import { Button } from "../../../../components/ui/Button";
```

---

# 7. Formato y calidad de código

Utilizar Prettier con configuración consistente.

El código debe mantener:

- formato consistente;
- imports organizados;
- nombres descriptivos;
- componentes pequeños cuando corresponda;
- responsabilidades claras.

No introducir estilos de código diferentes dentro del mismo proyecto.

---

# 8. Variables de entorno

Utilizar variables de entorno mediante Vite:

```typescript
import.meta.env;
```

Las variables utilizadas por la aplicación deben estar tipadas.

No colocar:

- secretos;
- claves privadas;
- credenciales;
- JWT signing secrets;
- passwords;

en variables de entorno destinadas al frontend.

Recordar que las variables del frontend terminan siendo accesibles por el cliente.

---

# 9. Routing

Utilizar React Router.

Las rutas deben organizarse de forma coherente con los módulos funcionales.

Preferir:

```text
/features/sindicatos
/features/provincias
/features/...
```

sobre una estructura basada exclusivamente en componentes de páginas.

Las rutas deben permitir lazy loading cuando el tamaño o la cantidad de funcionalidades lo justifique.

---

# 10. Features

Las funcionalidades de negocio deben organizarse por feature/módulo.

Ejemplo:

```text
features/
└── sindicatos/
    ├── components/
    ├── hooks/
    ├── pages/
    ├── services/
    ├── schemas/
    ├── types/
    └── index.ts
```

No colocar toda la lógica de todos los módulos en carpetas globales.

Los componentes verdaderamente reutilizables deben permanecer en:

```text
components/
```

La lógica específica de un módulo debe permanecer dentro de su feature.

---

# 11. Componentes

Los componentes deben tener una responsabilidad clara.

Distinguir entre:

### Componentes globales

Reutilizables en múltiples módulos:

```text
Button
Input
Modal
Table
Pagination
Loading
EmptyState
ErrorState
```

### Componentes de feature

Específicos de un módulo:

```text
SindicatoForm
SindicatoTable
SindicatoFilters
```

No convertir automáticamente cada elemento visual en un componente.

Evitar abstracciones prematuras.

---

# 12. Sistema visual

Utilizar un sistema de diseño o librería basada en Material cuando corresponda.

La apariencia debe tomar como referencia visual `liquidar-onboarding`.

Mantener consistencia en:

- colores;
- tipografía;
- tamaños;
- spacing;
- border radius;
- sombras;
- iconografía;
- estados;
- formularios;
- tablas;
- botones;
- navegación.

Los valores visuales deben centralizarse cuando sea posible mediante:

- theme;
- design tokens;
- variables;
- configuración del sistema de componentes.

No duplicar valores visuales arbitrariamente en cada componente.

---

# 13. Responsive design

La aplicación debe ser responsive.

Considerar como mínimo:

- desktop;
- tablet;
- mobile.

No asumir que una interfaz diseñada para desktop funciona correctamente en tamaños menores.

El layout debe adaptarse sin perder:

- navegación;
- legibilidad;
- accesibilidad;
- funcionalidad.

---

# 14. Layout de aplicación

La aplicación debe tener un shell común.

Conceptualmente:

```text
AppShell
├── Navbar
│   ├── nombre de la aplicación
│   └── usuario autenticado
│
├── Sidebar
│   └── navegación
│
└── MainContent
    └── Feature actual
```

El navbar y sidebar son componentes de aplicación, no componentes específicos de cada módulo.

El menú debe respetar los permisos disponibles para el usuario.

La ocultación de una opción en el menú **no reemplaza la autorización del backend**.

---

# 15. Estado global — Zustand

Utilizar Zustand para estado global de aplicación cuando corresponda.

Ejemplos:

- usuario/contexto de sesión;
- preferencias de UI;
- estado del sidebar;
- configuración global;
- información global que deba compartirse entre features.

No utilizar Zustand como repositorio genérico de todas las respuestas de la API.

Evitar almacenar en Zustand información que pertenece naturalmente al estado remoto.

---

# 16. Estado remoto — React Query

Cuando se utilice React Query, debe ser la fuente principal para el estado remoto administrado por esa consulta.

Utilizarlo para:

- fetching;
- cache;
- loading;
- error;
- refetch;
- invalidación;
- sincronización con backend.

Evitar copiar innecesariamente los datos de React Query a Zustand.

No mantener dos fuentes de verdad para los mismos datos.

---

# 17. Cliente HTTP

Utilizar Axios.

Los componentes y features no deben realizar llamadas Axios directamente.

Utilizar un adapter/client centralizado.

Conceptualmente:

```text
Feature
   ↓
Service
   ↓
ApiClient
   ↓
Axios
   ↓
Backend
```

El `ApiClient` debe centralizar aspectos comunes como:

- base URL;
- headers;
- autenticación;
- manejo de respuestas;
- errores HTTP;
- interceptores;
- comportamiento común de requests.

La implementación concreta debe respetar el patrón establecido en el proyecto.

No acoplar las features directamente a Axios.

---

# 18. Autenticación

La autenticación es responsabilidad de `Zenthia.Security.Api`.

El frontend consume el AccessToken emitido por Security.

No implementar un sistema de autenticación paralelo.

No generar JWT desde React.

No almacenar secretos.

No implementar RefreshToken fuera del mecanismo definido por Security.

El frontend debe tratar el token como credencial sensible.

---

# 19. Autorización

La autorización real corresponde al backend.

React puede utilizar los permisos para:

- mostrar/ocultar opciones del menú;
- mostrar/ocultar acciones;
- adaptar la interfaz;
- evitar ofrecer acciones que el usuario no puede ejecutar.

Pero nunca asumir que ocultar un botón constituye seguridad.

El backend debe validar siempre los permisos.

Ejemplo conceptual:

```text
React
  └── usuario tiene sindicatos:read
          ↓
      mostrar módulo
```

pero:

```text
Backend
  └── valida sindicatos:read
```

La UI nunca debe ser considerada una frontera de seguridad.

---

# 20. Formularios

Utilizar React Hook Form para formularios.

Utilizar Zod para validación.

La validación debe separar claramente:

- validación de UI;
- validación de contrato;
- reglas de negocio.

No duplicar innecesariamente reglas complejas del backend.

Las validaciones necesarias para una buena experiencia de usuario pueden ejecutarse en React, pero el backend sigue siendo responsable de validar la operación.

---

# 21. Estados de UI

Toda funcionalidad que consuma backend debe contemplar, cuando corresponda:

```text
Loading
Error
Empty
Success
```

No dejar pantallas en blanco ante un error.

Los estados deben ser visualmente consistentes con el sistema de diseño.

---

# 22. Manejo de errores

Los errores HTTP deben manejarse centralizadamente cuando sea posible.

Distinguir:

- error de autenticación;
- error de autorización;
- recurso inexistente;
- validación;
- conflicto;
- error de servidor;
- error de red.

No mostrar información técnica interna del backend al usuario.

Los mensajes mostrados al usuario deben ser apropiados para UI.

---

# 23. Accesibilidad

Implementar accesibilidad básica.

Como mínimo:

- labels asociados correctamente;
- navegación por teclado;
- atributos ARIA cuando sean necesarios;
- roles apropiados;
- estados de controles accesibles;
- contraste adecuado;
- mensajes de error accesibles.

No utilizar ARIA cuando un elemento HTML semántico resuelva correctamente el caso.

---

# 24. Performance

Utilizar lazy loading/code splitting para rutas cuando corresponda.

Evitar:

- imports innecesarios;
- renders evitables;
- componentes excesivamente grandes;
- cargas de datos innecesarias;
- imágenes excesivamente pesadas.

Optimizar imágenes y assets.

No realizar micro-optimizaciones sin evidencia de necesidad.

Priorizar primero una arquitectura clara y correcta.

---

# 25. Testing

Utilizar:

- Vitest;
- React Testing Library.

Los tests deben priorizar el comportamiento observable de la aplicación.

Cubrir especialmente:

- componentes críticos;
- formularios;
- validaciones;
- navegación;
- hooks;
- servicios;
- estados loading/error/empty;
- permisos visibles en UI;
- integración entre componentes relevantes.

No escribir tests que dependan innecesariamente de detalles internos de implementación.

Configurar coverage.

---

# 26. Migración desde Legacy

La migración será progresiva y módulo por módulo.

No migrar solamente pantallas.

Para cada módulo:

```text
Legacy
   ↓
Análisis funcional
   ↓
Backend API
   ↓
React Feature
   ↓
Validación
```

Una migración de frontend se considera completa cuando todas las funcionalidades de UI correspondientes al módulo fueron identificadas y migradas.

No dejar funcionalidades existentes sin documentar.

---

# 27. Relación con el backend

El frontend debe consumir el backend existente.

No implementar reglas de persistencia ni acceso directo a base de datos.

No crear endpoints desde el frontend.

Si el frontend necesita una funcionalidad que el backend todavía no expone:

1. documentar la necesidad;
2. identificar el endpoint requerido;
3. verificar si existe una alternativa;
4. no implementar una solución paralela contra la base de datos.

---

# 28. Cambios funcionales

No modificar silenciosamente el comportamiento del sistema durante la migración.

Si se detecta una oportunidad de mejora:

- documentarla;
- separar la mejora de la migración;
- no incorporarla automáticamente.

La migración debe permitir comparar el comportamiento nuevo con el legacy.

---

# 29. Dependencias

No agregar librerías sin necesidad.

Antes de incorporar una dependencia:

1. verificar si el stack existente ya resuelve el problema;
2. verificar si existe una solución simple;
3. evaluar mantenimiento y complejidad;
4. justificar la dependencia cuando corresponda.

Evitar crear múltiples librerías para resolver el mismo problema.

---

# 30. App de referencia visual

La aplicación `liquidar-onboarding` puede consultarse para mantener coherencia visual.

Utilizarla como referencia para:

- tema;
- colores;
- componentes;
- spacing;
- tipografía;
- navegación;
- formularios;
- tablas;
- layouts;
- responsive;
- estados visuales.

No copiar automáticamente:

- arquitectura;
- estructura de features;
- stores;
- servicios;
- autenticación;
- API;
- lógica de negocio;
- dependencias.

Si existe una diferencia entre la arquitectura de `liquidar-onboarding` y las reglas de este proyecto, prevalecen las reglas de este proyecto.

---

# 31. Regla de prioridad

Ante una contradicción, aplicar el siguiente orden:

```text
1. Requisitos explícitos del usuario
2. AGENTS.md raíz
3. frontend/AGENTS.md
4. Contrato real del backend
5. Código existente del nuevo frontend
6. liquidar-onboarding como referencia visual
```

`liquidar-onboarding` nunca debe utilizarse para contradecir una decisión arquitectónica del proyecto.

---

# 32. Regla general

Antes de implementar una funcionalidad:

1. comprender su comportamiento en el legacy;
2. verificar el contrato disponible en el backend;
3. revisar las reglas de este `AGENTS.md`;
4. revisar el patrón visual de `liquidar-onboarding`;
5. implementar la funcionalidad siguiendo la arquitectura del nuevo frontend;
6. validar comportamiento y estados;
7. agregar o actualizar tests.

No asumir.

No inventar funcionalidades.

No duplicar lógica del backend.

No introducir arquitectura innecesaria.

La aplicación React debe evolucionar como una aplicación web coherente, mantenible y progresivamente migrada, no como una colección de pantallas trasladadas individualmente desde WinForms.

## Patrón frontend de referencia: Obras Sociales

Obras Sociales constituye la referencia principal de arquitectura, composición
visual e interacción para las nuevas migraciones del frontend.

Cuando se solicite migrar un módulo tomando Obras Sociales como referencia,
deben aplicarse las reglas de esta sección.

### Fuentes de referencia

Inspeccionar obligatoriamente el código actual del repositorio:

- `src/features/obras-sociales/`
- `src/components/ui/DataGrid/`
- `src/components/ui/Modal/`
- `src/components/ui/Skeleton/`
- `src/app/AppRoutes.tsx`
- `src/layouts/AppShell.tsx`
- `docs/obras-sociales.md`

Estas rutas son relativas a `Zenthia.LiquidAR.Web`.

La implementación actual prevalece sobre descripciones históricas del chat.
Obras Sociales define cómo construir la interfaz; el legacy y el contrato real
del módulo que se migra definen sus funcionalidades, campos, validaciones,
relaciones, endpoints y permisos.

### Pantallas de listado

Seguir la composición actual de Obras Sociales:

- Integración en AppShell, ruta protegida con lazy loading y enlace del menú
  condicionado por el permiso real de lectura.
- DataGrid reutilizable con encabezado, toolbar, paginación y acciones por fila.
- Toolbar con Refrescar, Nuevo, selector de columnas y controles de
  búsqueda/filtros según las capacidades reales del backend.
- Refrescar vuelve a consultar el listado y permanece deshabilitado mientras
  esa consulta está en curso.
- Nuevo, Editar y Eliminar respetan los permisos de cada operación.
- Ver abre una consulta de solo lectura.
- Eliminar requiere confirmación y conserva el diálogo abierto ante errores.

Usar como configuración inicial de referencia:

- 25 registros por página.
- Opciones de tamaño 10, 25, 50 y 100, compatibles con el contrato del módulo.
- Filas de 48 px.
- Selección múltiple por página y contador de seleccionados.
- Corrección de la página actual cuando disminuye el total de registros.
- Columna Acciones visible cuando existan acciones disponibles.

En Obras Sociales las columnas visibles inicialmente son Código, Nombre, Email
y Teléfono, además de Acciones. Las demás quedan ocultas y disponibles en el
selector. En otros módulos, adaptar esta selección a sus campos reales y a las
indicaciones del usuario.

La selección de filas no implica crear operaciones masivas inexistentes.

La búsqueda, los filtros y el ordenamiento de un listado remoto deben respetar
el contrato del servidor. Cuando no estén soportados, mantenerlos deshabilitados
con una explicación; no aplicarlos únicamente a la página recibida.

### Diálogos de alta y edición

Reutilizar Modal y los controles compartidos. Alta y edición deben utilizar el
mismo formulario, con React Hook Form y Zod.

Cuando el módulo permita crear y editar, ofrecer:

- **Guardar:** persiste y mantiene abierto el diálogo en modo edición.
  Después de un alta utiliza el ID devuelto por la API; el siguiente guardado
  actualiza ese registro y no genera otra alta.
- **Guardar y nuevo:** persiste y abre un alta limpia después del éxito.
- **Guardar y cerrar:** persiste y cierra únicamente después del éxito.
- **Deshacer:** en alta restablece los valores iniciales; en edición descarta
  el borrador y vuelve a consultar el registro persistido.
- **Cancelar:** cierra y descarta los cambios locales sin enviar una escritura.

Reutilizar `src/components/ui/Modal/FormDialogActions.tsx` para las acciones
adicionales y la interpretación del destino de guardado. Guardar y cerrar
permanece como acción principal del Modal.

Los tres modos de guardado deben compartir validación, conversión del payload
y mutation. Solo cambia el destino posterior a una operación exitosa.

Durante una escritura:

- Bloquear campos y acciones incompatibles.
- Impedir cerrar mediante Cancelar, botón de cierre o Escape.
- Mostrar el estado de operación en curso.
- Evitar envíos duplicados.

Ante un error, conservar el diálogo y el borrador, mostrar el mensaje
normalizado y asociar los errores de validación a sus campos.

Después del éxito, mostrar confirmación, actualizar el detalle con la respuesta
del servidor e invalidar los listados afectados. Evitar recargas automáticas
que sustituyan un borrador en edición al recuperar foco o conexión.

Al reabrir edición, esperar el detalle actualizado antes de montar el formulario.
Consulta reutiliza el formulario en modo readonly, bloquea el envío y ofrece
únicamente Cerrar.

### Estados visuales y accesibilidad

- Permisos pendientes: DataGridSkeleton sin acciones interactivas.
- Listado inicial pendiente: filas skeleton del DataGrid.
- Datos del formulario pendientes: skeleton con la misma distribución,
  dimensiones y espaciados del formulario real.
- Durante esa carga, permitir cancelar y deshabilitar el guardado.
- Errores de carga: reemplazar el skeleton por el mensaje y el reintento.
- Listado vacío: mostrar un mensaje explícito.
- Mantener los bordes superior e inferior del header con el mismo grosor,
  estilo y color, tanto durante la carga como con datos.
- Verificar escritorio, tablet y móvil; permitir desplazamiento del contenido
  del diálogo manteniendo accesibles sus acciones.
- Conservar labels, navegación por teclado, foco y mensajes accesibles.

### Consistencia visual obligatoria entre módulos

- Tomar Obras Sociales y las referencias visuales aprobadas por el usuario
  como referencia de diseño para las nuevas pantallas migradas.
- Respetar tipografía, densidad, alturas de controles, etiquetas, bordes,
  fondos, espaciados, estados y disposición de las acciones.
- Mantener los campos y agrupaciones funcionales del layout legacy indicado,
  adaptándolos al diseño aprobado del frontend.
- Inputs y selectores deben compartir el mismo tratamiento visual.
  No dejar controles con apariencia nativa sin integrar al diseño.
- En formularios compactos, colocar las etiquetas a la izquierda del control,
  siguiendo el patrón aprobado y su adaptación responsive.
- En listas de detalles, presentar los datos y campos editables a la izquierda
  y las acciones a la derecha, en filas compactas. Activo es un dato editable, no una acción.
- Evitar tarjetas verticales y espacios vacíos que no existan en la referencia.
- Reutilizar componentes y estilos existentes. Revisar la herencia CSS para
  evitar que reglas globales alteren el layout del módulo.
- Mantener las acciones Guardar, Guardar y nuevo, Guardar y cerrar, Deshacer
  y Cancelar con el comportamiento y ubicación establecidos.
- Los skeleton deben reproducir la distribución y dimensiones del formulario.
- Antes de dar la tarea por terminada, comparar capturas con la referencia
  aprobada y verificar escritorio, tablet y móvil.
- Una compilación exitosa o pruebas funcionales correctas no sustituyen
  la revisión visual. No considerar finalizada una pantalla con diferencias
  de diseño pendientes.
  
### Arquitectura y contratos

Mantener el flujo:

Página/Formulario → hooks React Query → servicio → ApiClient → backend.

Reutilizar componentes compartidos antes de crear variantes. Mantener los
contratos y las consultas de cada feature separados cuando sus permisos o
endpoints sean diferentes.

Los campos, agrupaciones y reglas del formulario deben corresponder al módulo
migrado. No copiar automáticamente los campos ni las restricciones específicas
de Obras Sociales.

Utilizar exclusivamente endpoints y permisos confirmados. La autorización
efectiva continúa siendo responsabilidad del backend.

### Validación y documentación

Cubrir los tres modos de guardado, la transición de alta a edición sin duplicar
registros, Deshacer, cancelación, errores, permisos, eliminación, carga y vacío.

Verificar responsive, accesibilidad, estabilidad de los skeleton y bordes del
header. Ejecutar TypeScript, las pruebas pertinentes, build y formato.

Documentar las diferencias necesarias respecto de Obras Sociales y del legacy.
Toda funcionalidad o contrato que no pueda determinarse debe quedar identificado
como “No determinado”, junto con la información faltante.
