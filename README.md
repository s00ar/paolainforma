# Paola Informa Web

Sitio estático en italiano, español e inglés con HTML, CSS y JavaScript. Comparte el proyecto Firebase de la app móvil.

## Desarrollo y publicación

Trabajar desde la raíz del repositorio NUEVA PAOLA INFORMA. Ejecutar npm run build y versionar los archivos generados en la raíz, incluidas las carpetas it/, es/ y en/, que sirve Hostinger. No existe un subdirectorio web/ en este repositorio.

El build genera nombres de archivo con una huella de contenido y actualiza todas las dependencias locales, incluidas configuración, calendario y administración. Esto evita mezclar módulos de distintas versiones por caché.

El despliegue actual de Hostinger sirve la raíz directamente. Para compatibilidad, las referencias del código fuente incluyen una versión en la URL. Si se publica sin build, actualizar esa versión en los HTML y en todas las importaciones locales al modificar módulos. dist/ se conserva como salida adicional; el despliegue actual usa la raíz del repositorio.

## Firebase

La configuración pública del cliente está en firebase-config.js. Google necesita estar habilitado en Firebase Authentication y el dominio debe estar autorizado. El acceso usa una ventana de Google y conserva la sesión en el navegador.

Los indicadores de rides-settings.js controlan las funciones que requieren reglas de Firestore verificadas. No activarlos sin comprobar las reglas del proyecto compartido. Ver VIAJES.md y ADMINISTRACION.md para la activación.

No almacenar claves privadas ni credenciales administrativas en el sitio.

## Páginas y navegación

Cada sección del menú tiene su propio HTML: noticias, calendario, mapa, viajes, tienda, trabajo, alquileres y contactos. La portada ofrece accesos a todas ellas. Las políticas y el artículo de Ripopola también conservan páginas propias.

El contenido editable de las páginas está en `pages/`; el encabezado, pie, iconos y diálogos de cuenta compartidos están en `shared/`. Ejecutar `npm run build` regenera los HTML de la raíz y la salida de `dist/`. Hostinger despliega la raíz del repositorio: incluir los HTML generados al guardar cambios.

`app.js` comparte navegación y autenticación y carga solo los módulos de la página actual. `rides.js` contiene la lógica de Viajes. `pages.css` define la tipografía y el diseño común. `legacy-links.js` redirige los enlaces antiguos de la portada a sus nuevas páginas.

## Idiomas

Ver IDIOMAS.md para catálogos, páginas por idioma, servicio seguro de traducción, pruebas y pasos pendientes de activación.
