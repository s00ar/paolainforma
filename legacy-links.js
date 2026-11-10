/* Keep links shared before the move working. */
const legacyRoutes={noticias:'noticias.html',agenda:'calendario.html',mapa:'mapa.html',viajes:'viajes.html',tienda:'tienda.html',trabajo:'trabajo.html',alquileres:'alquileres.html',politicas:'politicas.html','san-martino-2026':'noticias.html#san-martino-2026','conductores-activos':'viajes.html#conductores-activos'};
function followLegacyLink(){const route=legacyRoutes[location.hash.slice(1)];if(route)location.replace('./'+route);}
followLegacyLink();addEventListener('hashchange',followLegacyLink);
