# LitroGo

Web para encontrar las gasolineras más cercanas y más baratas de España con los precios oficiales del Ministerio para la Transición Ecológica y el Reto Demográfico (los mismos datos que publica el Geoportal de Gasolineras).

## Estructura: 10 apartados

| # | Apartado | Página | Qué hace |
| --- | --- | --- | --- |
| 1 | Inicio | `index.html` | Búsqueda rápida, resumen de tu última zona y acceso a todo |
| 2 | Buscador | `buscador.html` | Dirección o ubicación, combustible, radio, orden por precio o cercanía |
| 3 | Mapa | `mapa.html` | Las mismas gasolineras con el mapa como protagonista |
| 4 | Comparador | `comparador.html` | Hasta 4 gasolineras lado a lado y coste de llenar el depósito |
| 5 | Calculadora de ahorro | `ahorro.html` | Ahorro neto al mes y al año, contando el desvío |
| 6 | Historial y estadísticas | `estadisticas.html` | Evolución de precios y marcas más baratas de tu zona |
| 7 | Favoritos | `favoritos.html` | Tus gasolineras con el precio de hoy |
| 8 | Alertas de precios | `alertas.html` | Aviso cuando se alcanza tu precio objetivo |
| 9 | Mi cuenta | `cuenta.html` | Vehículo, preferencias, descarga y borrado de tus datos |
| 10 | Servicios y opiniones | `opiniones.html` | Horario, servicios publicados y valoraciones |

- Menú del ordenador: Inicio · Buscador · Mapa · Comparador · Ahorro (5 y 6) · Mi LitroGo (7, 8 y 9) · Opiniones.
- En tablets y móviles, el botón "Menú" (o "Más" en la barra inferior) muestra los 10 apartados numerados.
- La cabecera, el menú y el pie se generan desde `js/ui.js`, así que se cambian en un solo sitio.
- `herramientas.html` redirige a las páginas nuevas para que los enlaces antiguos sigan funcionando.

### Código

- `js/comun.js`: datos del Ministerio, distancias, favoritos, alertas, opiniones, comparador, perfil y tema.
- `js/ui.js`: cabecera, menú y pie.
- `js/principal.js`: buscador y mapa.
- `js/herramientas.js`: el resto de apartados; cada página arranca su parte según `<body data-pagina>`.

## Cómo ponerla en marcha

La ubicación del navegador solo funciona en `https://` o en `localhost`, así que no abras los archivos con doble clic.

En local:

```bash
cd litrogo
python3 -m http.server 8080
# abre http://localhost:8080
```

Para publicarla gratis: sube la carpeta a GitHub Pages, Netlify o Cloudflare Pages. No necesita servidor propio ni compilación.

## Fuentes de datos

- Precios actuales: `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/`
- Histórico por municipio: `.../EstacionesTerrestresHist/FiltroMunicipio/{dd-mm-aaaa}/{IDMunicipio}`
- Direcciones: Nominatim (OpenStreetMap). Mapa: Leaflet con teselas de CARTO.

### Distancias

- Las distancias y los tiempos son por carretera, en coche. Por defecto se calculan con OSRM (rutas de OpenStreetMap, gratis y sin clave).
- Para que salgan exactamente las de Google Maps, pon una clave de Google en `GOOGLE_API_KEY` dentro de `js/comun.js`. La clave necesita la "Distance Matrix API" y la "Maps JavaScript API" activadas en Google Cloud. Google regala un cupo mensual y luego cobra por consulta.
- Si la ubicación del navegador es aproximada (pasa mucho en ordenadores sin GPS), la web lo avisa. Puedes escribir tu dirección o arrastrar el punto azul del mapa.

### Mapa

El mapa usa Leaflet con mapas vectoriales de [OpenFreeMap](https://openfreemap.org) (vistas Claro y Oscuro): son gratuitos, sin clave, sin límites y admiten uso comercial. La vista Satélite usa imágenes de Esri. Si los mapas vectoriales no cargan, se usan los de Esri, y si tampoco, un mapa de Google incrustado. No se usan los servidores de OpenStreetMap (tile.openstreetmap.org), porque bloquean este tipo de uso.

El listado completo pesa unos cuantos MB. Se guarda en caché (IndexedDB) durante 30 minutos.

Si el navegador bloquea la petición al Ministerio (error CORS), pon la URL de un proxy propio en la constante `PROXY` de `js/comun.js`.

## Qué se guarda y dónde

Los favoritos, las alertas, las opiniones y los precios registrados se guardan en el `localStorage` de cada navegador. Para que las opiniones sean públicas entre usuarios, o para mandar alertas con la web cerrada (correo o push), hace falta un backend: por ejemplo Supabase o Firebase para las opiniones, y una tarea programada que consulte la API y envíe los avisos.

Las alertas se comprueban cada vez que el usuario abre cualquiera de las dos páginas. Si ha activado las notificaciones, el aviso también le llega como notificación del navegador.

## Logo

En `img/` están el logo horizontal (`litrogo-logo.svg`), su versión para fondo oscuro (`litrogo-logo-oscuro.svg`), el icono (`litrogo-icono.svg`, y en PNG de 512, 192, 180 y 32 px) y una lámina de presentación. El texto del logo está convertido a trazados, así que se ve igual en cualquier ordenador.

Colores de marca: negro carbón #0B0F0E, verde #00E08A y verde oscuro #00A862 (para texto sobre blanco).

## Diseño

- Identidad verde y negra (variables en `css/estilos.css`) con **modo claro y oscuro**. Al entrar se usa el modo del sistema; el botón de la cabecera lo cambia y lo recuerda.
- En el móvil, el menú pasa a una barra inferior y los resultados se pueden ver como **lista** o como **mapa**. Al tocar una gasolinera se abre el mapa centrado en ella.
- El mapa empieza en la capa "Oscuro" o "Calles" según el tema, salvo que el usuario haya elegido otra.
- Las animaciones son suaves y se desactivan si el sistema tiene activado "reducir movimiento".
