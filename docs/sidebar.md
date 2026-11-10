# Menú lateral claro

El lateral utiliza los colores de la plantilla y la referencia visual aprobada.
AppShell conserva el orden, las rutas y las condiciones de permisos originales.
SidebarLink representa cada enlace independiente, con icono y estado activo de
React Router; permite incorporarlo a grupos futuros sin cambiar su destino ni
su autorización. Esta etapa no implementa grupos ni submenús.

El icono superior controla el lateral mediante uiStore. En escritorio comienza
expandido (260 px), puede contraerse a 80 px y mantiene ese estado al navegar.
En móvil (hasta 760 px) comienza oculto, se abre completo y se cierra al elegir
una pantalla. Los estados móvil/escritorio son independientes y se restablecen
con el reset existente de sesión. No se persisten entre recargas.

La navegación tiene desplazamiento propio para conservar el bloque inferior:
Configuración, Cerrar sesión y Perfil son controles deshabilitados, sin handlers.
Perfil utiliza las mismas iniciales y nombre disponibles en la barra superior.
El logout superior conserva su acción. No se incorpora modo oscuro ni se cambia
Security, backend, permisos o contratos. La mejora de presentación es propia de
la web y no altera reglas del legacy.

Validación: build/TypeScript, pruebas de permisos del AppShell y Playwright en
escritorio, tablet y móvil, incluyendo expansión/contracción, conservación del
estado al navegar, cierre móvil, controles inferiores inactivos, selector global,
logout superior y auditoría axe. Capturas revisadas contra la referencia clara.
