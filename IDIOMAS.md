# Italiano, español e inglés

## Interfaz y páginas

`locales/it.json`, `es.json` y `en.json` son la fuente de los textos. Las claves existentes se mantienen estables aunque se edite el texto. Las claves `ui.*` y `msg.*` fueron asignadas durante la extracción inicial; las nuevas claves deben ser descriptivas. Buscar el texto español en `es.json` permite localizar su clave. Para agregar un texto, agregar la misma clave en los tres archivos. No editar los HTML generados.

Las plantillas únicas están en `pages/` y `shared/`. `{{clave}}` inserta texto escapado; el HTML estructural permanece en la plantilla. En JavaScript se usa `t('clave', {nombre: valor})`. Para plurales usar un objeto `one/other` y `{count}`. `npm run check:i18n` valida claves, interpolaciones y plurales; el build falla si falta una traducción.

`npm run build` genera **en la raíz** `/it/`, `/es/`, `/en/`, páginas de compatibilidad españolas y sitemap. Hostinger sirve esa raíz; hay que versionar los HTML generados. `dist/` es una copia adicional, no el único destino. Las URLs explícitas respetan su idioma. La entrada general usa la preferencia recordada o italiano. Los enlaces españoles anteriores conservan destino, parámetros y fragmentos. Cambiar idioma no modifica Firebase Auth ni crea cuentas nuevas.

Los originales de mapas, logos y flyers se conservan. Los textos incrustados en imágenes no cambian; sus descripciones sí. La marca propia se conserva como **Paola y alrededores informa**.

## Publicaciones y contenido editorial

Productos, ofertas, alquileres, viajes y reseñas conservan su colección, identificador, autor, precio y permisos. `sourceLanguage` es opcional: `it`, `es`, `en` o `und` (sin determinar). Un documento anterior sin ese campo no se considera español automáticamente. Los campos de nombres, direcciones, números y teléfonos no se envían a traducir. El texto libre aportado por el autor sí se procesa y puede contener esos datos; el proveedor debe conservarlos. En viajes solo hay localidades: se conservan sus nombres y se traducen los controles y fechas.

Las noticias, artículos y guías usan el modelo editorial existente `webBlogPosts` con `contentKind` opcional (`news`, `article`, `guide`); no se duplica el documento por idioma. Los eventos conservan `webCalendarEvents`. El panel permite editar el original y abrir **Versiones por idioma** para cada registro, cargar una versión y guardar una traducción revisada. Solo administradores pueden hacerlo; el servidor vuelve a comprobar su rol. El contenido estático previo (por ejemplo Ripopola y la guía de contactos) se mantiene traducido en los catálogos y se edita mediante las plantillas/catálogos del repositorio, como antes.

Los originales se muestran siempre que no haya traducción actual. Las traducciones automáticas están rotuladas y permiten volver al original. Un hash de los campos del texto y su idioma identifica la versión; un cambio invalida la traducción y el índice anteriores. El panel señala versiones pendientes de actualizar. Los borradores no se traducen automáticamente ni se envían al proveedor. Sus traducciones revisadas solo pueden recuperarlas administradores.

## Servicio preparado, activación independiente

El código está en `functions/`, usa el **mismo proyecto Firebase** y Google Cloud Translation v3 NMT. El worker anterior es un webhook de notificaciones móviles, no un procesador fiable de cambios de Firestore; se conserva. Los triggers específicos de Firestore preparan traducciones y términos de búsqueda al crear/modificar contenido. No dependen de pulsar «Traducir». Un trabajo horario reintenta tareas fallidas; la publicación original sigue visible.

Las traducciones y el índice se guardan en `webTranslations`. Los clientes no pueden leer ni escribir esa colección directamente: el callable comprueba el original, el rol, su visibilidad y la versión, también después de procesar. La búsqueda une términos de los tres idiomas y devuelve los mismos documentos originales; vuelve a comprobar versión y caducidad. La búsqueda usa palabras completas normalizadas, no búsqueda semántica ni coincidencia difusa. Devuelve hasta 50 resultados de hasta 100 candidatos; conviene refinar búsquedas amplias.

Controles de costo: 20.000 caracteres por documento, cuota global predeterminada de 10.000 caracteres de entrada al día, reserva de cuota antes de llamar al proveedor, 60 solicitudes por usuario/IP anonimizada por minuto, máximo dos instancias por función, bloqueo temporal para evitar traducciones simultáneas de la misma versión y reutilización de resultados. La cuota de caracteres **no limita todos los costos de Firebase**. Configurar alertas y límites de gasto de la infraestructura. La limpieza por TTL de `webTranslationLimits.expiresAt` debe configurarse al activar.

### Costos y autorización

No se ha contratado ni activado consumo. Google publica un crédito mensual equivalente a los primeros 500.000 caracteres de NMT y USD 20 por millón posterior. Traducir un texto a dos idiomas cuenta dos veces; la detección automática de documentos antiguos también debe contemplarse al presupuestar. Cloud Functions necesita Blaze y puede generar cargos de cómputo, Firestore, Scheduler y despliegue aun dentro del crédito de traducción.

Fuentes consultadas: https://cloud.google.com/products/translate/pricing y https://firebase.google.com/docs/functions/quotas. Verificar las tarifas antes de activar facturación.

### Pasos de activación

1. Publicar **todo** `firestore.rules` y `firestore.indexes.json` en `paola-informa`. Puede hacerse con `firebase deploy --only firestore --project paola-informa` desde una cuenta autorizada. No reemplazar las reglas por fragmentos ni ampliar permisos globales. Las reglas conservan compatibilidad con los documentos anteriores y el acceso legacy móvil.
2. Tras confirmar las reglas, poner `languageMetadataEnabled = true` en `content-settings.js`, reconstruir y publicar. Hasta entonces los formularios continúan guardando con el esquema anterior y explican que la elección de idioma está pendiente de activar.
3. Tras autorización del costo, habilitar Blaze y Cloud Translation API. El servicio usa la identidad de ejecución de Cloud Functions (ADC), sin claves en el navegador. Conceder a esa identidad el rol mínimo Cloud Translation API User y acceso Firestore de servidor. Usar la región `europe-west1` definida en el código; confirmar la ubicación existente de Firestore y cualquier requisito regional antes de desplegar.
4. En la configuración privada de las funciones definir `TRANSLATION_ENABLED=true` y, si se desea otro límite, `TRANSLATION_DAILY_CHARACTERS=10000`. No guardar archivos `.env` ni credenciales en Git. Desde `functions/`, `npm ci`; desde la raíz, `firebase deploy --only functions:languages --project paola-informa`. No desplegar hosting de Firebase: el sitio sigue en Hostinger.
5. Comprobar el callable `languageContent`, sus triggers, el índice y las cuotas. Luego activar `translationServiceEnabled = true` en `content-settings.js`, reconstruir y publicar. Mantenerlo false antes de desplegar evita falsas traducciones o llamadas a un servicio inexistente.
6. Preparar publicaciones anteriores mediante el callable `backfill`, solo como administrador: `{action:'backfill', collection:'webMarketOffers', after:''}`. Procesa hasta 20 documentos y devuelve `after` para continuar. Repetir para trabajo, alquileres, viajes, blog, eventos web y móviles. Para reseñas usar collection webDriverReviews; el cursor after devuelto es la ruta completa de la reseña. La cuota puede dejar tareas pendientes para el reintento horario.
7. Probar en producción con cuentas reales: propietario, administrador delegado y usuario común. Confirmar Google, publicación/edición/borrado, reseñas, traducción y búsqueda cruzada. Las pruebas locales no sustituyen esta comprobación.

## Pruebas reproducibles

- `npm test`: catálogos, URL/fragmentos, plurales, caché, invalidación, detección de documentos antiguos y permisos del núcleo (proveedor simulado).
- `node tests/browser.mjs`: Chromium con Firebase simulado; requiere Playwright instalado. Revisa las 33 páginas a 360/390/768/1440 px, enlaces antiguos, sesión, formulario sin guardar y una misma publicación en tres idiomas. Capturas en `test-results/` (no se publican).
- `firebase emulators:exec --config firebase.test.json --only firestore --project demo-paola "node tests/rules.mjs"`: requiere `@firebase/rules-unit-testing` y `firebase`; comprueba permisos reales del emulador.
- `GCLOUD_PROJECT=demo-paola` y `FIRESTORE_EMULATOR_HOST=127.0.0.1:8180`, ejecutar `node --test functions/test/service.test.js` dentro de la sesión del emulador. Comprueba el callable real con caché de prueba, sin consumir traducciones.

No se guardan claves de proveedor, no se escriben publicaciones de prueba en producción y no se presentan sesiones simuladas como cuentas reales.
