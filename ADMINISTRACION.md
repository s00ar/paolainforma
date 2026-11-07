# Activación de calendario y administración

1. En Authentication → Usuarios del proyecto Firebase `paola-informa`, identificá la cuenta de Google que debe ser propietaria y copiá su UID. Si todavía no figura, ingresá una vez a la web con esa cuenta.
2. Compará las reglas activas de Firestore con `firestore.rules`. Conservá las reglas de producción para la app móvil y el panel. Excluí todas las colecciones web de cualquier permiso global. Confirmá que `events` y `calendarEvents` solo contengan la agenda destinada al público antes de habilitar sus lecturas públicas.
3. Publicá las reglas revisadas. En Firestore, creá el documento `webAdminConfig/owner` con el campo `uid` de tipo cadena y el UID del paso 1. No guardes el correo ni el UID del propietario en los archivos del sitio.
4. Probá con el propietario y una cuenta común. El propietario debe poder gestionar administradores. Un administrador delegado puede gestionar blogs, eventos y choferes. Un usuario común solo puede leer contenido publicado y gestionar sus propios datos de viajes.
5. Habilitá `editorialEnabled` en `rides-settings.js` y publicá. Habilitá `ridesEnabled` después de comprobar los permisos de Viajes.

El calendario inicial incluye San Martino. Una vez activada la conexión, también lee las colecciones de agenda de la app y del panel existente, además de los eventos creados desde la web. Los borradores de blog solo aparecen en administración. Eliminar a un chofer retira su perfil y su disponibilidad y lo bloquea hasta que un administrador quite el bloqueo.
