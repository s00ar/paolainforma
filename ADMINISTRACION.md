# Administración de la plataforma

La cuenta propietaria se reconoce mediante el correo verificado del proveedor Google definido en siteOwner() en firestore.rules. Solo esa cuenta puede crear, editar o eliminar delegaciones en webAdmins. No es necesario crear webAdminConfig/owner para esta versión.

Los administradores pueden gestionar blogs, eventos y conductores desde Administración. Pueden editar o eliminar ofertas laborales, alquileres y productos desde sus tarjetas, y reseñas desde los perfiles. Los permisos se verifican en Firestore, no solo en los botones.

Publicar TODO firestore.rules antes de activar editorialEnabled, directoryEnabled y marketEnabled. Las reglas aíslan las colecciones web del acceso heredado de la aplicación móvil. rentalsEnabled también requiere sus reglas publicadas.

Cada usuario conserva el control de sus propias publicaciones y reseñas. Solo se admite una reseña por usuario y conductor; el conductor no puede calificarse a sí mismo. Las reseñas contienen de 1 a 5 estrellas y un texto de hasta 500 caracteres.

Los perfiles de conductores permanecen registrados cuando vence la disponibilidad. La disponibilidad verde significa que el conductor se marcó disponible y el plazo no venció; no significa que esté conectado al navegador.
