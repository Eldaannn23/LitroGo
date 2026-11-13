/* ==========================================================
   LitroGo - utilidades compartidas por todas las páginas
   Fuente de datos: API REST de precios de carburantes del
   Ministerio para la Transición Ecológica y el Reto Demográfico
   (la misma que alimenta el Geoportal de Gasolineras).
   ========================================================== */
const GR = (() => {
  const API = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/";

  /* Si el navegador bloqueara la petición directa (CORS), puedes poner aquí
     la URL de tu propio proxy, p. ej. "https://mi-proxy.workers.dev/?url=".
     Se usa solo como plan B si la petición directa falla. */
  const PROXY = "";

  const CACHE_MINUTOS = 30;
  /* Hasta esta antigüedad, el listado guardado se enseña al momento mientras se descarga el nuevo */
  const CACHE_MAX_HORAS = 24;

  /* Distancias por carretera.
     - Sin clave: se usa OSRM (OpenStreetMap), gratuito, mismas rutas en coche que un navegador GPS.
     - Con clave de Google (Distance Matrix activada en Google Cloud), las distancias son
       exactamente las de Google Maps. Pega aquí tu clave: "AIza...". */
  const GOOGLE_API_KEY = "";

  const COMBUSTIBLES = [
    { id: "g95", nombre: "Gasolina 95", campo: "Precio Gasolina 95 E5", idProducto: 1 },
    { id: "g98", nombre: "Gasolina 98", campo: "Precio Gasolina 98 E5", idProducto: 3 },
    { id: "diesel", nombre: "Diésel", campo: "Precio Gasoleo A", idProducto: 4 },
    { id: "dieselp", nombre: "Diésel Premium", campo: "Precio Gasoleo Premium", idProducto: 5 },
    { id: "glp", nombre: "GLP", campo: "Precio Gases licuados del petróleo", idProducto: 17 },
  ];
  const combustible = (id) => COMBUSTIBLES.find((c) => c.id === id) || COMBUSTIBLES[0];

  /* ---------- Iconos SVG (sin emojis) ---------- */
  const P = {
    gota: '<path d="M12 2.7s-6 6.4-6 11a6 6 0 0 0 12 0c0-4.6-6-11-6-11z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    mira: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    estrella: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    ruta: '<path d="M3 11 21 3l-8 18-2-8z"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15v3"/>',
    grafica: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
    campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>',
    precio: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    papelera: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h0M11 12h1v5h1"/>',
    surtidor: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M3 21h13M7 8h5"/><path d="M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    bajada: '<path d="m3 7 6 6 4-4 8 8"/><path d="M21 11v6h-6"/>',
    capas: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    casa: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    comparar: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M6.5 9h0M17.5 9h0"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
    coche: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    descargar: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  };
  const icono = (n, clase = "ico") => `<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;

  /* ---------- Almacenamiento local seguro ---------- */
  const leer = (k, def) => { try { const v = localStorage.getItem("gr_" + k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem("gr_" + k, JSON.stringify(v)); } catch {} };

  /* IndexedDB para la caché del listado completo (son varios MB) */
  const idb = {
    abrir() {
      return new Promise((res, rej) => {
        if (!("indexedDB" in window)) return rej("sin idb");
        const r = indexedDB.open("gasoradar", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("datos");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) {
      try {
        const db = await this.abrir();
        return await new Promise((res) => { const q = db.transaction("datos").objectStore("datos").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
      } catch { return null; }
    },
    async set(k, v) {
      try {
        const db = await this.abrir();
        await new Promise((res) => { const t = db.transaction("datos", "readwrite"); t.objectStore("datos").put(v, k); t.oncomplete = res; t.onerror = res; });
      } catch {}
    },
  };

  /* ---------- Datos del Ministerio ---------- */
  const num = (s) => { if (s === undefined || s === null || s === "") return null; const n = parseFloat(String(s).replace(",", ".")); return isFinite(n) ? n : null; };

  function normalizar(e) {
    const precios = {};
    COMBUSTIBLES.forEach((c) => { const v = num(e[c.campo]); if (v) precios[c.id] = v; });
    return {
      id: e.IDEESS,
      rotulo: (e["Rótulo"] || "Sin marca").trim(),
      direccion: titulo(e["Dirección"] || ""),
      localidad: titulo(e.Localidad || ""),
      municipio: titulo(e.Municipio || ""),
      idMunicipio: e.IDMunicipio,
      provincia: titulo(e.Provincia || ""),
      cp: e["C.P."],
      horario: e.Horario || "",
      tipoVenta: e["Tipo Venta"] || "",
      margen: e.Margen || "",
      remision: e["Remisión"] || "",
      lat: num(e.Latitud),
      lon: num(e["Longitud (WGS84)"]),
      precios,
    };
  }
  function titulo(s) { return s.toLowerCase().replace(/(^|[\s,.(/-])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase()); }

  async function pedir(url) {
    const intentos = [url];
    if (PROXY) intentos.push(PROXY + encodeURIComponent(url));
    let ultimoError;
    for (const u of intentos) {
      try {
        const r = await fetch(u, { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } catch (err) { ultimoError = err; }
    }
    throw ultimoError;
  }

  let memoria = null, refresco = null;
  async function descargarEstaciones() {
    const j = await pedir(API + "EstacionesTerrestres/");
    const estaciones = (j.ListaEESSPrecio || []).map(normalizar).filter((e) => e.lat && e.lon);
    memoria = { fecha: j.Fecha, guardado: Date.now(), estaciones };
    idb.set("estaciones", memoria);
    registrarPreciosFavoritos(memoria);
    return memoria;
  }
  /** Devuelve { fecha, estaciones[] }.
      - Listado guardado hace menos de 30 minutos: se usa tal cual.
      - Guardado hace menos de 24 horas: se devuelve al momento (marcado "antiguo") y se
        descarga el nuevo en segundo plano; al llegar se lanza el evento "datosactualizados".
      - Si no hay nada guardado: se descarga (varios MB, tarda unos segundos).          */
  async function cargarEstaciones(forzar = false) {
    if (memoria && !forzar) return memoria;
    if (!forzar) {
      const c = await idb.get("estaciones");
      const edad = c ? Date.now() - c.guardado : Infinity;
      if (edad < CACHE_MINUTOS * 60000) { memoria = c; return c; }
      if (edad < CACHE_MAX_HORAS * 3600000) {
        memoria = { ...c, antiguo: true };
        if (!refresco) refresco = descargarEstaciones()
          .then((d) => window.dispatchEvent(new CustomEvent("datosactualizados", { detail: d })))
          .catch((err) => console.warn("No se pudieron actualizar los precios:", err))
          .finally(() => { refresco = null; });
        return memoria;
      }
    }
    return descargarEstaciones();
  }

  /* Primera visita: mientras baja el listado completo de España, se piden solo las
     provincias más cercanas al punto de búsqueda (descargas pequeñas y rápidas).
     Cada provincia: [código, latitud y longitud aproximadas de su centro].          */
  const PROVINCIAS = [
    ["01", 42.83, -2.72], ["02", 38.83, -1.98], ["03", 38.48, -0.57], ["04", 37.20, -2.34], ["05", 40.57, -4.95], ["06", 38.71, -6.14],
    ["07", 39.57, 2.91], ["08", 41.73, 1.98], ["09", 42.37, -3.59], ["10", 39.71, -6.16], ["11", 36.55, -5.76], ["12", 40.24, -0.15],
    ["13", 38.93, -3.83], ["14", 37.99, -4.81], ["15", 43.13, -8.46], ["16", 39.90, -2.20], ["17", 42.13, 2.67], ["18", 37.31, -3.27],
    ["19", 40.81, -2.63], ["20", 43.14, -2.19], ["21", 37.58, -6.83], ["22", 42.20, -0.07], ["23", 38.02, -3.44], ["24", 42.62, -5.84],
    ["25", 42.04, 1.05], ["26", 42.27, -2.52], ["27", 43.01, -7.45], ["28", 40.50, -3.72], ["29", 36.81, -4.73], ["30", 38.00, -1.49],
    ["31", 42.67, -1.65], ["32", 42.20, -7.59], ["33", 43.29, -5.99], ["34", 42.37, -4.54], ["35", 28.36, -14.55], ["36", 42.44, -8.46],
    ["37", 40.80, -6.07], ["38", 28.31, -17.02], ["39", 43.20, -4.03], ["40", 41.17, -4.05], ["41", 37.44, -5.68], ["42", 41.62, -2.59],
    ["43", 41.09, 0.82], ["44", 40.66, -0.82], ["45", 39.79, -4.15], ["46", 39.37, -0.80], ["47", 41.63, -4.85], ["48", 43.24, -2.85],
    ["49", 41.73, -5.98], ["50", 41.62, -1.06], ["51", 35.89, -5.32], ["52", 35.29, -2.94],
  ];
  const zonas = new Map();
  /** { fecha, estaciones[], parcial: true } con las gasolineras de las 3 provincias más cercanas. */
  function estacionesZona(lat, lon, n = 3) {
    const ids = PROVINCIAS.map(([id, a, b]) => [id, distanciaKm(lat, lon, a, b)]).sort((x, y) => x[1] - y[1]).slice(0, n).map((x) => x[0]);
    const clave = ids.join("-");
    if (!zonas.has(clave)) {
      zonas.set(clave, Promise.all(ids.map((id) => pedir(`${API}EstacionesTerrestres/FiltroProvincia/${id}`)))
        .then((js) => ({ fecha: js[0].Fecha, parcial: true, estaciones: js.flatMap((j) => (j.ListaEESSPrecio || []).map(normalizar)).filter((e) => e.lat && e.lon) }))
        .catch((err) => { zonas.delete(clave); throw err; }));
    }
    return zonas.get(clave);
  }

  /** Histórico oficial de un municipio para una fecha (dd-mm-aaaa). */
  async function historicoMunicipio(fecha, idMunicipio) {
    const clave = `hist_${fecha}_${idMunicipio}`;
    const c = await idb.get(clave);
    if (c) return c;
    const j = await pedir(`${API}EstacionesTerrestresHist/FiltroMunicipio/${fecha}/${idMunicipio}`);
    const lista = (j.ListaEESSPrecio || []).map(normalizar);
    idb.set(clave, lista);
    return lista;
  }

  /* ---------- Geografía ---------- */
  function distanciaKm(a, b, c, d) {
    const R = 6371, rad = Math.PI / 180;
    const x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const urlMaps = (e, o) => `https://www.google.com/maps/dir/?api=1${o ? `&origin=${o.lat},${o.lon}` : ""}&destination=${e.lat},${e.lon}&travelmode=driving`;

  /* ---------- Distancia real por carretera ---------- */
  const cacheRutas = new Map();
  const claveRuta = (o, e) => `${o.lat.toFixed(5)},${o.lon.toFixed(5)}>${e.id}`;

  async function osrm(o, dests) {
    const res = [];
    for (let i = 0; i < dests.length; i += 80) {
      const lote = dests.slice(i, i + 80);
      const coords = [`${o.lon},${o.lat}`, ...lote.map((e) => `${e.lon},${e.lat}`)].join(";");
      const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance,duration`);
      if (!r.ok) throw new Error("OSRM " + r.status);
      const j = await r.json();
      if (j.code !== "Ok") throw new Error("OSRM " + j.code);
      lote.forEach((e, k) => {
        const d = j.distances[0][k + 1], t = j.durations[0][k + 1];
        res.push(d == null ? null : { km: d / 1000, min: t / 60 });
      });
    }
    return res;
  }

  let promesaGoogle = null;
  function cargarGoogle() {
    if (!promesaGoogle) promesaGoogle = new Promise((ok, mal) => {
      if (window.google?.maps?.DistanceMatrixService) return ok();
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_API_KEY)}&language=es&region=ES`;
      s.onload = () => ok(); s.onerror = () => mal(new Error("Google Maps no cargó"));
      document.head.appendChild(s);
    });
    return promesaGoogle;
  }
  async function googleMatriz(o, dests) {
    await cargarGoogle();
    const svc = new google.maps.DistanceMatrixService();
    const res = [];
    for (let i = 0; i < dests.length; i += 25) {
      const lote = dests.slice(i, i + 25);
      const r = await svc.getDistanceMatrix({
        origins: [{ lat: o.lat, lng: o.lon }],
        destinations: lote.map((e) => ({ lat: e.lat, lng: e.lon })),
        travelMode: "DRIVING",
      });
      r.rows[0].elements.forEach((el) => res.push(el.status === "OK" ? { km: el.distance.value / 1000, min: el.duration.value / 60 } : null));
    }
    return res;
  }

  /** Devuelve, para cada destino, {km, min} por carretera (o null si no se pudo). */
  async function distanciasCarretera(o, dests) {
    const pendientes = dests.filter((e) => !cacheRutas.has(claveRuta(o, e)));
    if (pendientes.length) {
      let r;
      if (GOOGLE_API_KEY) { try { r = await googleMatriz(o, pendientes); } catch (err) { console.warn(err); } }
      if (!r) r = await osrm(o, pendientes);
      pendientes.forEach((e, i) => cacheRutas.set(claveRuta(o, e), r[i]));
    }
    return dests.map((e) => cacheRutas.get(claveRuta(o, e)));
  }
  const fuenteDistancias = () => (GOOGLE_API_KEY ? "Google Maps" : "OpenStreetMap");

  async function direccionDe(lat, lon) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&accept-language=es&lat=${lat}&lon=${lon}`);
      const j = await r.json();
      const a = j.address || {};
      const calle = [a.road, a.house_number].filter(Boolean).join(" ");
      return [calle, a.city || a.town || a.village || a.municipality].filter(Boolean).join(", ") || j.display_name;
    } catch { return null; }
  }

  async function geocodificar(texto) {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=es&accept-language=es&q=" + encodeURIComponent(texto);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("geocodificación");
    return (await r.json()).map((x) => ({ nombre: x.display_name, lat: +x.lat, lon: +x.lon }));
  }

  /* ---------- Ubicación del usuario ----------
     1) Wifi / GPS del navegador (se afina como mucho un segundo).
     2) Si tarda o falla (no por permiso denegado): posición aproximada por la conexión
        a internet (IP), que se sustituye por la buena en cuanto llega.            */
  function errorUbicacion(code) {
    const archivo = location.protocol === "file:";
    const e = new Error(
      code === 1
        ? (archivo
          ? "El navegador no deja usar la ubicación porque la web está abierta como archivo de tu ordenador. Cuando esté publicada en internet (https) o abierta desde un servidor local (localhost) funcionará."
          : "El navegador tiene bloqueada la ubicación para esta web. Pulsa el icono que hay a la izquierda de la dirección de la página, cambia Ubicación a Permitir y recarga.")
        : "Tu dispositivo no ha podido darnos la ubicación. En Windows revisa Configuración > Privacidad y seguridad > Ubicación (debe estar activada, también para el navegador)."
    );
    e.code = code; return e;
  }

  /* Lectura del navegador (wifi / GPS).
     - Si el permiso ya está concedido, se piden a la vez la posición por wifi (casi
       instantánea, y vale una de hace pocos minutos) y la del GPS, y se usa la primera
       buena (±150 m). Como mucho se esperan 7 s.
     - Si el navegador aún tiene que preguntar, se hace una sola petición (dos a la vez
       pueden hacer que algunos navegadores la rechacen) y no se cuenta el tiempo que la
       persona tarda en contestar.                                                     */
  function lecturaRapida(estadoPermiso) {
    return new Promise((res, rej) => {
      let mejor = null, fin = false, idW = null, tRefinar = null, tMax = null, errores = 0, peticiones = 0;
      const acabar = (err) => {
        if (fin) return; fin = true;
        if (idW !== null) navigator.geolocation.clearWatch(idW);
        clearTimeout(tRefinar); clearTimeout(tMax);
        mejor ? res(mejor) : rej(err || errorUbicacion(2));
      };
      const afinar = () => {
        if (idW !== null || fin) return;
        peticiones++;
        idW = navigator.geolocation.watchPosition(ok, ko, { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 });
      };
      const ok = (p) => {
        if (fin) return;
        const l = { lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy };
        if (!mejor || l.precision < mejor.precision) mejor = l;
        if (l.precision <= 150) return acabar();
        afinar(); // llegó una posición aproximada: se intenta mejorar un momento con el GPS
        if (!tRefinar) tRefinar = setTimeout(() => acabar(), 1200);
      };
      const ko = (e) => {
        if (fin) return;
        if (mejor) return acabar();
        if (e.code === 1) return acabar(errorUbicacion(1));
        if (++errores >= peticiones) acabar(errorUbicacion(e.code));
      };
      peticiones++;
      navigator.geolocation.getCurrentPosition(ok, ko, { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60000 });
      // mientras se muestra la pregunta del navegador no hay límite propio
      if (estadoPermiso === "granted") { afinar(); tMax = setTimeout(() => acabar(errorUbicacion(3)), 7000); }
    });
  }

  /* Posición aproximada por la conexión a internet. Se pregunta a los tres servicios a la
     vez (cada uno con un límite de 3,5 s) y se usa el primero que conteste bien. El
     resultado se recuerda 30 minutos.                                                  */
  const VIDA_IP = 30 * 60000;
  async function pedirJSON(url, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(url, { signal: c.signal });
      if (!r.ok) throw new Error(url + " " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  let promesaIP = null;
  function ubicacionPorIP() {
    const previa = leer("posicionIP", null);
    if (previa && Date.now() - previa.t < VIDA_IP) return Promise.resolve(previa);
    if (!promesaIP) {
      const servicios = [
        ["https://ipwho.is/", (j) => ({ lat: j.latitude, lon: j.longitude, ciudad: j.city })],
        ["https://get.geojs.io/v1/ip/geo.json", (j) => ({ lat: +j.latitude, lon: +j.longitude, ciudad: j.city })],
        ["https://ipapi.co/json/", (j) => ({ lat: j.latitude, lon: j.longitude, ciudad: j.city })],
      ];
      promesaIP = Promise.any(servicios.map(async ([url, leerJ]) => {
        const l = leerJ(await pedirJSON(url, 3500));
        if (!(isFinite(l.lat) && isFinite(l.lon) && l.lat)) throw new Error("sin datos");
        return { ...l, precision: 5000, porIP: true };
      })).then((ip) => { guardar("posicionIP", { ...ip, t: Date.now() }); return ip; })
        .catch(() => { promesaIP = null; return null; });
    }
    return promesaIP;
  }

  /* Pide la ubicación sin hacer esperar:
     - La última posición buena se reutiliza 3 minutos (cambiar de página es instantáneo).
       "forzar" (el botón "Mi ubicación") pide siempre una lectura nueva.
     - Si el navegador tarda más de 2,5 s y quien llama pasa "alMejorar", se devuelve ya
       la posición aproximada por internet marcada como "provisional" y se sigue buscando
       la buena. Al terminar se llama a alMejorar(posición): la precisa si llegó, o la
       aproximada (porIP) si el navegador no pudo.
     - Si el navegador ha fallado hace poco (10 min), no se le vuelve a esperar: se
       responde al momento con la aproximada.                                          */
  const VIDA_POSICION = 3 * 60000, VIDA_FALLO = 10 * 60000, ESPERA_NAVEGADOR = 2500;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  async function pedirUbicacion({ forzar = false, alMejorar = null } = {}) {
    const previa = leer("ultimaPosicion", null);
    if (!forzar && previa && Date.now() - previa.t < VIDA_POSICION && !previa.porIP) return previa;
    if (!navigator.geolocation) {
      const ip = await ubicacionPorIP();
      if (ip) return ip;
      throw new Error("Tu navegador no permite obtener la ubicación.");
    }
    let estado = "prompt";
    try {
      const est = await navigator.permissions?.query({ name: "geolocation" });
      if (est) estado = est.state;
    } catch {}
    if (estado === "denied") throw errorUbicacion(1);
    const concedido = estado === "granted";
    const falloReciente = concedido && Date.now() - leer("falloUbicacion", 0) < VIDA_FALLO;

    // páginas que no pueden actualizarse después: si el navegador acaba de fallar, no se repite la espera
    if (falloReciente && !forzar && !alMejorar) {
      const ip = await ubicacionPorIP();
      if (ip) return ip;
    }

    // la aproximada solo se pide si hace falta (el navegador tarda o ha fallado)
    let ipEnCamino = null;
    const pedirIP = () => ipEnCamino || (ipEnCamino = ubicacionPorIP());
    const tIP = concedido ? setTimeout(pedirIP, falloReciente ? 0 : 800) : null;

    const definitiva = lecturaRapida(estado).then(
      (p) => {
        clearTimeout(tIP);
        guardar("ultimaPosicion", { ...p, t: Date.now() });
        guardar("falloUbicacion", 0);
        return p;
      },
      async (e) => {
        clearTimeout(tIP);
        console.warn("Ubicación:", e.message);
        if (e.code === 1) throw e;
        guardar("falloUbicacion", Date.now());
        const ip = await pedirIP();
        if (ip) return ip;
        throw e;
      }
    );
    if (!alMejorar || !concedido) return definitiva;

    const provisional = esperar(falloReciente ? 0 : ESPERA_NAVEGADOR).then(pedirIP).then((ip) => (ip ? { ...ip, provisional: true } : definitiva));
    const primera = await Promise.race([definitiva, provisional]);
    if (primera.provisional) definitiva.then((p) => alMejorar(p), () => alMejorar(null));
    return primera;
  }

  /* ---------- Formato ---------- */
  const fmtPrecio = (p) => (p == null ? "--" : p.toFixed(3).replace(".", ","));
  const fmtEuros = (n, dec = 2) => (n == null || !isFinite(n) ? "--" : n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " €");
  const fmtKm = (k) => (k < 1 ? Math.round(k * 1000) + " m" : k.toFixed(1).replace(".", ",") + " km");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iniciales = (s) => s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "G";
  /* ---------- Logos de las marcas ----------
     Se usa el icono oficial que publica la web de cada compañía (servicio de favicons de Google).
     Si no hay icono o es demasiado pequeño, se muestran las iniciales. */
  const MARCAS = [
    [/REPSOL|CAMPSA|PETRONOR/, "repsol.es"],
    [/CEPSA|MOEVE/, "cepsa.es"],
    [/\bBP\b/, "bp.com"],
    [/GALP/, "galp.com"],
    [/SHELL/, "shell.es"],
    [/BALLENOIL/, "ballenoil.es"],
    [/PLENOIL/, "plenoil.es"],
    [/PLENERGY/, "plenergy.es"],
    [/PETROPRIX/, "petroprix.com"],
    [/ALCAMPO/, "alcampo.es"],
    [/CARREFOUR/, "carrefour.es"],
    [/EROSKI/, "eroski.es"],
    [/BONAREA|BON AREA/, "bonarea.com"],
    [/COSTCO/, "costco.es"],
    [/LECLERC/, "e-leclerc.es"],
    [/\bAVIA\b/, "avia-international.com"],
    [/\bDISA\b/, "disagrupo.es"],
    [/MEROIL/, "meroil.es"],
    [/GASEXPRESS|GAS EXPRESS/, "gasexpress.es"],
    [/PETROCAT/, "petrocat.cat"],
  ];
  function dominioMarca(rotulo) {
    const t = String(rotulo || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const m = MARCAS.find(([re]) => re.test(t));
    return m ? m[1] : null;
  }
  function logoHTML(rotulo, clase = "") {
    const ini = esc(iniciales(rotulo || ""));
    const d = dominioMarca(rotulo);
    if (!d) return `<span class="inicial ${clase}">${ini}</span>`;
    return `<span class="inicial con-logo ${clase}" data-ini="${ini}" title="${esc(rotulo)}"><img src="https://www.google.com/s2/favicons?domain=${d}&sz=64" alt="" loading="lazy" referrerpolicy="no-referrer" onload="GR.revisarLogo(this)" onerror="GR.sinLogo(this)"></span>`;
  }
  function sinLogo(img) { const s = img.parentElement; if (!s) return; s.classList.remove("con-logo"); s.textContent = s.dataset.ini; }
  function revisarLogo(img) { if (img.naturalWidth < 24) sinLogo(img); } // el icono genérico de "sin logo" mide 16 px

  const hoyClave = () => new Date().toISOString().slice(0, 10);

  /* ---------- Favoritos ---------- */
  const favoritos = {
    todos: () => leer("favoritos", []),
    es: (id) => favoritos.todos().some((f) => f.id === id),
    alternar(e) {
      let l = favoritos.todos();
      if (l.some((f) => f.id === e.id)) { l = l.filter((f) => f.id !== e.id); guardar("favoritos", l); return false; }
      l.unshift({ id: e.id, rotulo: e.rotulo, direccion: e.direccion, municipio: e.municipio, idMunicipio: e.idMunicipio, lat: e.lat, lon: e.lon, precios: e.precios, añadido: Date.now() });
      guardar("favoritos", l);
      registrarPrecio(e);
      return true;
    },
    quitar(id) { guardar("favoritos", favoritos.todos().filter((f) => f.id !== id)); },
  };

  /* Historial propio: cada día que se consultan datos, se guarda el precio de los favoritos */
  function registrarPrecio(e) {
    const h = leer("historial", {});
    h[e.id] = h[e.id] || {};
    h[e.id][hoyClave()] = e.precios;
    guardar("historial", h);
  }
  function registrarPreciosFavoritos(datos) {
    const ids = new Set(favoritos.todos().map((f) => f.id));
    if (!ids.size) return;
    datos.estaciones.forEach((e) => ids.has(e.id) && registrarPrecio(e));
  }

  /* ---------- Alertas ---------- */
  const alertas = {
    todas: () => leer("alertas", []),
    guardar: (l) => guardar("alertas", l),
    anadir(a) { const l = alertas.todas(); l.unshift({ ...a, id: Date.now().toString(36), creada: Date.now(), ultimoAviso: null }); alertas.guardar(l); },
    quitar(id) { alertas.guardar(alertas.todas().filter((a) => a.id !== id)); },
  };

  /** Evalúa una alerta contra los datos actuales y devuelve la mejor coincidencia (o null). */
  function evaluarAlerta(a, datos) {
    let candidatas;
    if (a.tipo === "estacion") candidatas = datos.estaciones.filter((e) => e.id === a.estacionId);
    else candidatas = datos.estaciones.filter((e) => distanciaKm(a.lat, a.lon, e.lat, e.lon) <= a.radio);
    let mejor = null;
    candidatas.forEach((e) => { const p = e.precios[a.combustible]; if (p && (!mejor || p < mejor.precio)) mejor = { estacion: e, precio: p }; });
    return mejor ? { ...mejor, cumple: mejor.precio <= a.objetivo } : null;
  }

  async function comprobarAlertas(datos) {
    const l = alertas.todas();
    if (!l.length) return;
    let cambio = false;
    l.forEach((a) => {
      const r = evaluarAlerta(a, datos);
      a.ultimoPrecio = r ? r.precio : null;
      if (r && r.cumple && a.ultimoAviso !== hoyClave()) {
        a.ultimoAviso = hoyClave(); cambio = true;
        const msg = `${combustible(a.combustible).nombre} a ${fmtPrecio(r.precio)} €/L en ${r.estacion.rotulo} (${r.estacion.municipio}). Tu objetivo: ${fmtPrecio(a.objetivo)} €/L.`;
        toast("Bajada de precio", msg, "alerta", 9000);
        try { if ("Notification" in window && Notification.permission === "granted") new Notification("LitroGo: bajada de precio", { body: msg }); } catch {}
      }
    });
    alertas.guardar(l);
    return cambio;
  }

  /* ---------- Opiniones ---------- */
  const opiniones = {
    todas: () => leer("opiniones", {}),
    de: (id) => opiniones.todas()[id] || [],
    anadir(id, o) { const t = opiniones.todas(); t[id] = [{ ...o, fecha: Date.now() }, ...(t[id] || [])]; guardar("opiniones", t); },
    media(id) { const l = opiniones.de(id); return l.length ? l.reduce((s, o) => s + o.nota, 0) / l.length : null; },
  };

  /* ---------- Interfaz ---------- */
  function toast(titulo, texto, tipo = "", ms = 4500) {
    let c = document.querySelector(".toasts");
    if (!c) { c = document.createElement("div"); c.className = "toasts"; document.body.appendChild(c); }
    const t = document.createElement("div");
    t.className = "toast " + tipo;
    t.innerHTML = `<b>${esc(titulo)}</b>${esc(texto)}`;
    c.appendChild(t);
    setTimeout(() => { t.style.transition = "0.3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, ms);
  }

  function estrellasHTML(nota, mini = true) {
    let h = `<span class="estrellas ${mini ? "mini" : ""}">`;
    for (let i = 1; i <= 5; i++) h += `<span class="${i <= Math.round(nota) ? "on" : ""}">${icono("estrella", "")}</span>`;
    return h + "</span>";
  }

  /* ---------- Carga compartida de datos para cualquier página ---------- */
  let promesaDatos = null;
  function datos() {
    if (!promesaDatos) {
      promesaDatos = cargarEstaciones().then((d) => {
        window.dispatchEvent(new CustomEvent("datoscargados", { detail: d }));
        if (!d.antiguo) comprobarAlertas(d); // con precios de ayer no se avisa: se espera a los nuevos
        return d;
      }).catch((err) => { promesaDatos = null; throw err; });
    }
    return promesaDatos;
  }
  /* Llegan los precios nuevos que se estaban descargando en segundo plano */
  window.addEventListener("datosactualizados", (ev) => {
    promesaDatos = Promise.resolve(ev.detail);
    window.dispatchEvent(new CustomEvent("datoscargados", { detail: ev.detail }));
    comprobarAlertas(ev.detail);
  });

  /* Gasolineras más cercanas a la persona (por su ubicación o su última búsqueda),
     para los desplegables de opiniones, historial y alertas.                     */
  let cercanas = [], promCercanas = null;
  function cargarCercanas(n = 30) {
    if (!promCercanas) promCercanas = (async () => {
      let o = null;
      if (leer("prefUbicacion", null) !== "no") { try { o = await pedirUbicacion(); } catch {} }
      o = o || leer("ultimoOrigen", null);
      if (!o) return [];
      const d = await datos();
      cercanas = d.estaciones
        .map((e) => ({ ...resumenEstacion(e), km: distanciaKm(o.lat, o.lon, e.lat, e.lon) }))
        .sort((a, b) => a.km - b.km).slice(0, n);
      window.dispatchEvent(new CustomEvent("cercanascargadas"));
      return cercanas;
    })().catch(() => { promCercanas = null; return []; });
    return promCercanas;
  }

  /* Estaciones que el usuario conoce: cercanas, favoritas, a comparar, extra y últimas vistas */
  const extraConocidas = [];
  function estacionesConocidas() {
    const m = new Map();
    [...cercanas, ...favoritos.todos(), ...comparar.todas(), ...extraConocidas, ...leer("recientes", [])].forEach((e) => { if (e && !m.has(e.id)) m.set(e.id, e); });
    return [...m.values()];
  }
  function opcionesEstaciones(sel, excluir) {
    const favs = new Set(favoritos.todos().map((f) => f.id));
    const fuera = (e) => excluir && excluir.has(e.id);
    const comb = combustible(leer("combustible", "g95"));
    const opt = (e, txt) => `<option value="${esc(e.id)}" ${e.id === sel ? "selected" : ""}>${txt}</option>`;
    const cerca = cercanas.filter((e) => !fuera(e));
    const idsCerca = new Set(cerca.map((e) => e.id));
    const resto = estacionesConocidas().filter((e) => !fuera(e) && !idsCerca.has(e.id));
    let h = "";
    if (cerca.length) {
      h += `<optgroup label="Cerca de ti · ${esc(comb.nombre)}">` + cerca.map((e) => {
        const p = e.precios?.[comb.id];
        return opt(e, `${favs.has(e.id) ? "★ " : ""}${esc(e.rotulo)}  ·  ${p ? fmtPrecio(p) + " €/L" : "sin " + esc(comb.nombre)}  ·  ${fmtKm(e.km)}  —  ${esc(e.direccion)}`);
      }).join("") + "</optgroup>";
    }
    if (resto.length) {
      const l = resto.map((e) => opt(e, `${favs.has(e.id) ? "★ " : ""}${esc(e.rotulo)} - ${esc(e.direccion)}, ${esc(e.municipio)}`)).join("");
      h += cerca.length ? `<optgroup label="Tus favoritas y vistas recientemente">${l}</optgroup>` : l;
    }
    if (!h) return `<option value="">${promCercanas ? "Buscando gasolineras cercanas..." : excluir ? "No quedan más gasolineras: busca otras en el buscador" : "Comparte tu ubicación o busca gasolineras en el buscador"}</option>`;
    return h;
  }
  /* ---------- Selector visual de gasolineras ----------
     Sustituye a la vista del <select> (que sigue existiendo y guarda el valor) por un
     botón con la gasolinera elegida y un panel con buscador, orden y tarjetas.     */
  function mejorarSelector(sel) {
    if (!sel || sel.dataset.mejorado) return;
    sel.dataset.mejorado = "1";
    const campo = sel.closest(".campo") || sel.parentElement;
    campo.classList.add("sel-est");
    sel.classList.add("sel-est-nativo"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    const boton = document.createElement("button");
    boton.type = "button"; boton.className = "sel-est-boton"; boton.setAttribute("aria-haspopup", "listbox"); boton.setAttribute("aria-expanded", "false");
    sel.parentElement.appendChild(boton);
    const label = campo.querySelector("label"); if (label) label.htmlFor = "";
    if (label) label.addEventListener("click", () => boton.focus());
    const panel = document.createElement("div");
    panel.className = "sel-est-panel oculto";
    panel.innerHTML = `<div class="sel-est-cab">
        <div class="sel-est-buscar">${icono("buscar")}<input type="search" placeholder="Buscar por marca, calle o municipio" aria-label="Buscar gasolinera"></div>
        <div class="orden"><button type="button" data-o="cerca" class="activo">Más cerca</button><button type="button" data-o="precio">Más barata</button></div>
      </div><div class="sel-est-lista" role="listbox"></div>`;
    campo.appendChild(panel);
    const lista = panel.querySelector(".sel-est-lista"), buscar = panel.querySelector("input");
    let orden = "cerca";

    const info = (id) => estacionesConocidas().find((e) => e.id === id);
    const comb = () => combustible(leer("combustible", "g95"));
    function nivel(p) {
      const ps = cercanas.map((e) => e.precios?.[comb().id]).filter(Boolean);
      if (!p || ps.length < 3) return "";
      const min = Math.min(...ps), max = Math.max(...ps), r = max - min;
      if (r < 0.005) return "medio";
      return p - min <= r / 3 ? "bajo" : p - min >= (2 * r) / 3 ? "alto" : "medio";
    }
    const favs = () => new Set(favoritos.todos().map((f) => f.id));
    function tarjeta(e, extra = "") {
      const p = e.precios?.[comb().id];
      return `${logoHTML(e.rotulo)}
        <span class="sel-est-info"><b>${favs().has(e.id) ? `<span class="sel-est-fav">${icono("estrella")}</span>` : ""}${esc(e.rotulo)}</b><small>${esc(e.direccion)}${e.municipio ? ", " + esc(e.municipio) : ""}</small></span>
        <span class="sel-est-datos">${p ? `<strong class="${nivel(p)}">${fmtPrecio(p)}<small> €/L</small></strong>` : `<em>Sin ${esc(comb().nombre)}</em>`}${e.km != null ? `<span class="sel-est-km">${fmtKm(e.km)}</span>` : ""}</span>${extra}`;
    }
    function pintarBoton() {
      const o = sel.selectedOptions[0];
      const e = o && o.value ? info(o.value) : null;
      boton.innerHTML = e ? tarjeta(e, `<span class="sel-est-flecha">${icono("abajo")}</span>`)
        : `<span class="sel-est-vacio">${esc(o ? o.textContent : "Elige una gasolinera")}</span><span class="sel-est-flecha">${icono("abajo")}</span>`;
      boton.disabled = sel.disabled;
    }
    function pintarPanel() {
      const q = buscar.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const casa = (e) => !q || `${e.rotulo} ${e.direccion} ${e.municipio}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q);
      const grupos = [];
      const grupoDe = (titulo, opts) => grupos.push({ titulo, ids: [...opts].filter((o) => o.value).map((o) => o.value) });
      const og = sel.querySelectorAll("optgroup");
      if (og.length) og.forEach((g) => grupoDe(g.label, g.querySelectorAll("option")));
      else grupoDe("", sel.querySelectorAll("option"));
      const c = comb().id;
      let h = "";
      grupos.forEach((g, i) => {
        let l = g.ids.map(info).filter(Boolean).filter(casa);
        if (orden === "precio") l.sort((a, b) => (a.precios?.[c] || 99) - (b.precios?.[c] || 99));
        else if (l.every((e) => e.km != null)) l.sort((a, b) => a.km - b.km);
        if (!l.length) return;
        if (g.titulo) h += `<div class="sel-est-grupo">${esc(g.titulo)}<span>${l.length}</span></div>`;
        h += l.map((e) => `<button type="button" role="option" class="sel-est-op ${e.id === sel.value ? "activa" : ""}" data-id="${esc(e.id)}" aria-selected="${e.id === sel.value}">${tarjeta(e)}</button>`).join("");
      });
      if (!h) {
        const o = sel.querySelector("option");
        h = `<p class="sel-est-nada">${q ? "No hay gasolineras que coincidan con la búsqueda." : esc(o ? o.textContent : "No hay gasolineras.")}</p>`;
      }
      lista.innerHTML = h;
    }
    const abierto = () => !panel.classList.contains("oculto");
    function abrir() {
      document.querySelectorAll(".sel-est-panel:not(.oculto)").forEach((p) => p !== panel && p.classList.add("oculto"));
      panel.classList.remove("oculto"); boton.setAttribute("aria-expanded", "true"); campo.classList.add("abierto");
      buscar.value = ""; pintarPanel();
      const act = lista.querySelector(".activa"); if (act) act.scrollIntoView({ block: "nearest" });
      if (matchMedia("(pointer: fine)").matches) buscar.focus();
    }
    function cerrar(devolverFoco) {
      panel.classList.add("oculto"); boton.setAttribute("aria-expanded", "false"); campo.classList.remove("abierto");
      if (devolverFoco) boton.focus();
    }
    boton.addEventListener("click", () => (abierto() ? cerrar() : abrir()));
    buscar.addEventListener("input", pintarPanel);
    panel.querySelector(".orden").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-o]"); if (!b) return;
      orden = b.dataset.o; panel.querySelectorAll(".orden button").forEach((x) => x.classList.toggle("activo", x === b)); pintarPanel();
    });
    lista.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-id]"); if (!b) return;
      sel.value = b.dataset.id; sel.dispatchEvent(new Event("change", { bubbles: true }));
      pintarBoton(); cerrar(true);
    });
    panel.addEventListener("keydown", (ev) => {
      const ops = [...lista.querySelectorAll(".sel-est-op")];
      const i = ops.indexOf(document.activeElement);
      if (ev.key === "Escape") { ev.preventDefault(); cerrar(true); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); (ops[i + 1] || ops[0])?.focus(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); (i > 0 ? ops[i - 1] : buscar).focus(); }
      else if (ev.key === "Enter" && document.activeElement === buscar && ops[0]) { ev.preventDefault(); ops[0].click(); }
    });
    document.addEventListener("click", (ev) => { if (abierto() && !campo.contains(ev.target)) cerrar(); });
    sel.addEventListener("change", pintarBoton);
    new MutationObserver(() => { pintarBoton(); if (abierto()) pintarPanel(); }).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    window.addEventListener("cercanascargadas", pintarBoton);
    pintarBoton();
  }

  const opcionesComb = (sel) => COMBUSTIBLES.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${c.nombre}</option>`).join("");
  const resumenEstacion = ({ id, rotulo, direccion, municipio, idMunicipio, lat, lon, precios, horario }) => ({ id, rotulo, direccion, municipio, idMunicipio, lat, lon, precios, horario });

  /* ---------- Comparador: hasta 4 gasolineras ---------- */
  const comparar = {
    max: 4,
    todas: () => leer("comparar", []),
    tiene: (id) => comparar.todas().some((e) => e.id === id),
    alternar(e) {
      let l = comparar.todas();
      if (l.some((x) => x.id === e.id)) { guardar("comparar", l.filter((x) => x.id !== e.id)); return false; }
      if (l.length >= comparar.max) return null;
      l.push(resumenEstacion(e)); guardar("comparar", l); return true;
    },
    quitar(id) { guardar("comparar", comparar.todas().filter((x) => x.id !== id)); },
  };

  /* ---------- Perfil del usuario (en este dispositivo hasta la Fase 4) ---------- */
  const PERFIL_BASE = { nombre: "", marca: "", modelo: "", anio: "", vehiculo: "Mi coche", combustible: "g95", consumo: 6.5, deposito: 50, radio: 10, ubicacion: "preguntar" };
  const perfil = {
    leer: () => ({ ...PERFIL_BASE, ...leer("perfil", {}), combustible: leer("combustible", PERFIL_BASE.combustible), radio: leer("radio", PERFIL_BASE.radio) }),
    guardar(p) {
      const { combustible, radio, ...resto } = p;
      guardar("perfil", resto); guardar("combustible", combustible); guardar("radio", radio);
      if (p.ubicacion === "siempre") guardar("prefUbicacion", "si");
      else if (p.ubicacion === "nunca") guardar("prefUbicacion", "no");
      else { try { localStorage.removeItem("gr_prefUbicacion"); } catch {} }
      if (p.nombre) guardar("nombre", p.nombre);
    },
  };

  /* ---------- Tema claro / oscuro ---------- */
  const temaActual = () => document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro";
  function ponerTema(t, guardarlo = true) {
    document.documentElement.dataset.tema = t;
    if (guardarlo) guardar("tema", t);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === "oscuro" ? "#070a09" : "#f5f7f6";
    window.dispatchEvent(new CustomEvent("cambiotema", { detail: t }));
  }
  const colorTema = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  function iniciarTema() {
    ponerTema(temaActual(), false);
    const b = document.getElementById("btn-tema");
    if (b) b.addEventListener("click", () => ponerTema(temaActual() === "oscuro" ? "claro" : "oscuro"));
    // si el usuario no ha elegido, seguimos al sistema
    try {
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { if (!leer("tema", null)) ponerTema(e.matches ? "oscuro" : "claro", false); });
    } catch {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarTema); else iniciarTema();

  return {
    temaActual, ponerTema, colorTema, datos, estacionesConocidas, extraConocidas, opcionesEstaciones, cargarCercanas, mejorarSelector, opcionesComb, comparar, perfil, resumenEstacion,
    API, COMBUSTIBLES, combustible, icono, leer, guardar, cargarEstaciones, estacionesZona, historicoMunicipio,
    distanciaKm, urlMaps, geocodificar, distanciasCarretera, fuenteDistancias, direccionDe, pedirUbicacion, fmtPrecio, fmtEuros, fmtKm, esc, iniciales, logoHTML, sinLogo, revisarLogo,
    favoritos, alertas, evaluarAlerta, comprobarAlertas, opiniones, toast, estrellasHTML, registrarPrecio, hoyClave,
  };
})();
