# Activación de Viajes en Firebase

1. Confirmá que Google esté habilitado en Authentication y que el dominio de la web figure en Authorized domains.
2. Compará las reglas de Firestore publicadas con `firestore.rules`. Incorporá las cuatro colecciones de viajes y excluilas de cualquier regla general que permita leer o escribir. Las reglas coincidentes de Firestore se combinan por OR. El archivo reproduce el acceso previo de la app móvil para las demás colecciones. Si producción usa reglas distintas, conservá esas reglas al incorporar el cambio.
3. Publicá las reglas en el proyecto Firebase compartido. Comprobá con dos cuentas de Google que cada cuenta solo pueda modificar sus propios datos y que los teléfonos se oculten al retirar el anuncio o vencer la disponibilidad.
4. Cambiá `ridesEnabled` a `true` en `rides-settings.js` y publicá la web.

El estado de un chofer dura entre 1 y 8 horas y se puede retirar antes. La pertenencia a Remix se declara en el formulario. Los teléfonos se guardan por separado y solo se consultan al abrir un contacto. No hay datos de demostración en los listados.
