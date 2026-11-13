/* ==========================================================
   LitroGo - página principal (buscador + mapa)
   ========================================================== */
(() => {
  const { icono, esc, fmtPrecio, fmtKm, fmtEuros } = GR;
  const $ = (s) => document.querySelector(s);

  const estado = {
    origen: null,
    combustible: GR.leer("combustible", "g95"),
    radio: GR.leer("radio", 10),
    orden: "precio",
    resultados: [],
    seleccionado: null,
    mostrar: 40,
    cortes: [0, 0],
    rutas: "pendiente", // pendiente | calculando | ok | error
  };


  /* ==========================================================
     MAPA: Leaflet con varios CDN de respaldo, varios proveedores
     de teselas y, como último recurso, un mapa de Google incrustado.
     ========================================================== */
  let mapa = null, capaMarcadores = null, marcadorYo = null, circulo = null, modoGoogle = false;
  const marcadores = new Map();

  function cargarScript(src) {
    return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
  }
  function cargarCSS(href) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); }

  async function asegurarLeaflet() {
    if (window.L?.map) return true;
    const cdns = [
      ["https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js", "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"],
      ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"],
    ];
    for (const [js, css] of cdns) {
      try { cargarCSS(css); await cargarScript(js); if (window.L?.map) return true; } catch {}
    }
    return false;
  }

  /* ---------- Mapas base ----------
     Claro y Oscuro: mapas vectoriales de OpenFreeMap (gratis, sin clave, sin límites y con uso comercial permitido).
     Satélite: imágenes de Esri. Si los mapas vectoriales no cargan, se usan los de Esri.
     Último recurso: mapa de Google incrustado. No se usan los servidores de OpenStreetMap,
     que bloquean este tipo de uso. */
  const OFM = "https://tiles.openfreemap.org/styles/";
  const ATTR_OFM = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  const ATTR_ESRI = 'Mapa &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics';
  const capaEsri = (ruta, max = 19, nativo = 19) => L.tileLayer(ESRI + ruta + "/MapServer/tile/{z}/{y}/{x}", { maxZoom: max, maxNativeZoom: nativo, attribution: ATTR_ESRI });
  const VISTAS = ["Claro", "Oscuro", "Satélite"];

  let promesaVectorial = null, vectorialOk = true;
  function asegurarVectorial() {
    if (!promesaVectorial) promesaVectorial = (async () => {
      if (window.maplibregl && L.maplibreGL) return true;
      const libs = [
        ["https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css", "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js", "https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js"],
        ["https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css", "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js", "https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js"],
      ];
      for (const [css, js, plugin] of libs) {
        try {
          cargarCSS(css);
          if (!window.maplibregl) await cargarScript(js);
          if (!L.maplibreGL) await cargarScript(plugin);
          if (window.maplibregl && L.maplibreGL) return true;
        } catch {}
      }
      return false;
    })();
    return promesaVectorial;
  }

  function crearCapa(nombre) {
    if (nombre !== "Satélite" && vectorialOk && L.maplibreGL) {
      const c = L.maplibreGL({ style: OFM + (nombre === "Oscuro" ? "dark" : "liberty"), attribution: ATTR_OFM });
      c._vectorial = true;
      return c;
    }
    if (nombre === "Oscuro") return L.layerGroup([capaEsri("Canvas/World_Dark_Gray_Base", 19, 16), capaEsri("Canvas/World_Dark_Gray_Reference", 19, 16)]);
    if (nombre === "Satélite") return L.layerGroup([capaEsri("World_Imagery"), capaEsri("Reference/World_Transportation"), capaEsri("Reference/World_Boundaries_and_Places")]);
    return capaEsri("World_Street_Map");
  }

  function vistaInicial() {
    let v = GR.leer("capaMapa", null);
    if (v === "Calles") v = "Claro"; // nombre antiguo
    return VISTAS.includes(v) ? v : GR.temaActual() === "oscuro" ? "Oscuro" : "Claro";
  }

  async function iniciarMapa() {
    const ok = await asegurarLeaflet();
    if (!ok) { activarGoogle(); return; }
    try {
      mapa = L.map("mapa", { zoomControl: true }).setView([40.2, -3.7], 6);
    } catch (err) { console.error(err); activarGoogle(); return; }
    capaMarcadores = L.layerGroup().addTo(mapa);
    vectorialOk = await asegurarVectorial();
    ponerVistaMapa(vistaInicial());
    mapa.on("baselayerchange", (ev) => { capaTeselas = ev.layer; GR.guardar("capaMapa", ev.name); vigilar(ev.layer, ev.name); });
    // el contenedor puede cambiar de tamaño (móvil, carga de fuentes...)
    const ajustar = () => mapa && mapa.invalidateSize();
    setTimeout(ajustar, 200); setTimeout(ajustar, 1000);
    window.addEventListener("resize", ajustar);
    if ("ResizeObserver" in window) new ResizeObserver(ajustar).observe($("#mapa"));
    if (estado.origen) pintarMapa();
  }

  let capaTeselas = null, controlCapas = null, turnoVista = 0;
  function ponerVistaMapa(nombre) {
    if (!mapa || modoGoogle) return;
    if (capaTeselas) mapa.removeLayer(capaTeselas);
    if (controlCapas) { controlCapas.remove(); controlCapas = null; }
    const capas = {};
    VISTAS.forEach((n) => (capas[n] = crearCapa(n)));
    capaTeselas = capas[nombre];
    capaTeselas.addTo(mapa);
    controlCapas = L.control.layers(capas, null, { position: "topright", collapsed: false }).addTo(mapa);
    vigilar(capaTeselas, nombre);
  }

  /* Comprueba que el mapa base carga de verdad; si no, pasa al siguiente proveedor */
  function vigilar(capa, nombre) {
    const turno = ++turnoVista;
    let ok = false, errores = 0;
    const fallo = () => {
      if (turno !== turnoVista || ok || modoGoogle || !mapa) return;
      if (capa._vectorial) { console.warn("Mapa vectorial no disponible; se usa Esri"); vectorialOk = false; ponerVistaMapa(nombre); }
      else if (nombre !== "Satélite" || errores) { console.warn("Mapa base no disponible; se usa el mapa de Google"); activarGoogle(); }
    };
    if (capa._vectorial) {
      const enganchar = () => {
        const gl = capa.getMaplibreMap && capa.getMaplibreMap();
        if (!gl) return setTimeout(enganchar, 100);
        if (gl.loaded && gl.loaded()) ok = true;
        gl.on("load", () => { ok = true; });
        gl.on("error", (e) => { errores++; if (!ok && errores >= 3) fallo(); });
      };
      enganchar();
    } else {
      const contar = (l) => (l.eachLayer ? l.eachLayer(contar) : (l.on("tileload", () => { ok = true; }), l.on("tileerror", () => { errores++; if (!ok && errores >= 6) fallo(); })));
      contar(capa);
    }
    setTimeout(fallo, 9000);
  }

  /* Respaldo: mapa de Google incrustado (no necesita clave) */
  function activarGoogle() {
    if (modoGoogle) return;
    modoGoogle = true;
    if (mapa) { try { mapa.remove(); } catch {} mapa = null; }
    $("#mapa").innerHTML = '<iframe id="mapa-google" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="border:0;width:100%;height:100%"></iframe>';
    $(".leyenda").classList.add("oculto");
    centrarGoogle();
  }
  function centrarGoogle(e) {
    const f = $("#mapa-google"); if (!f) return;
    const p = e || estado.resultados[0] || estado.origen;
    f.src = p ? `https://maps.google.com/maps?q=${p.lat},${p.lon}&z=${e ? 16 : 13}&hl=es&output=embed` : "https://maps.google.com/maps?q=España&z=6&hl=es&output=embed";
  }

  window.addEventListener("cambiotema", (ev) => {
    if (!mapa || modoGoogle) return;
    if (!GR.leer("capaMapa", null)) ponerVistaMapa(ev.detail === "oscuro" ? "Oscuro" : "Claro");
    if (circulo) circulo.setStyle({ color: GR.colorTema("--acento") });
  });

  /* ---------- Vista lista / mapa en pantallas pequeñas ---------- */
  const esMovil = () => matchMedia("(max-width: 1050px)").matches;
  function ponerVista(v) {
    document.querySelector(".zona-resultados").classList.toggle("ver-mapa", v === "mapa");
    document.querySelectorAll("[data-vista]").forEach((b) => b.classList.toggle("activo", b.dataset.vista === v));
    if (v === "mapa" && mapa) setTimeout(() => mapa.invalidateSize(), 60);
  }
  document.querySelectorAll("[data-vista]").forEach((b) => b.addEventListener("click", () => ponerVista(b.dataset.vista)));

  function nivel(p) { return p <= estado.cortes[0] ? "barato" : p <= estado.cortes[1] ? "medio" : "caro"; }

  function pintarMapa(ajustarVista = true) {
    if (modoGoogle) { centrarGoogle(); return; }
    if (!mapa) return;
    capaMarcadores.clearLayers(); marcadores.clear();
    if (marcadorYo) marcadorYo.remove();
    if (circulo) circulo.remove();
    if (!estado.origen) return;
    const o = estado.origen;
    marcadorYo = L.marker([o.lat, o.lon], {
      draggable: true, zIndexOffset: 2000,
      icon: L.divIcon({ className: "", html: '<div class="yo"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
    }).bindTooltip("Tu punto de búsqueda. Arrástralo si no está bien situado.").addTo(mapa);
    marcadorYo.on("dragend", () => {
      const p = marcadorYo.getLatLng();
      buscarDesde({ lat: p.lat, lon: p.lng, nombre: "Punto elegido en el mapa", exacto: true }, true);
    });
    circulo = L.circle([o.lat, o.lon], { radius: estado.radio * 1000, color: GR.colorTema("--acento") || "#00b86b", weight: 1.5, opacity: 0.6, fillOpacity: 0.04, dashArray: "6 6", interactive: false }).addTo(mapa);

    estado.resultados.slice(0, 300).forEach((e) => {
      const m = L.marker([e.lat, e.lon], {
        icon: L.divIcon({ className: "contenedor-marcador", html: `<span class="marcador ${nivel(e.precio)} ${estado.seleccionado === e.id ? "sel" : ""}" data-id="${e.id}">${fmtPrecio(e.precio)}</span>`, iconSize: [0, 0] }),
      });
      m.on("click", () => seleccionar(e.id, false));
      m.bindPopup(() => popupHTML(e), { maxWidth: 260 });
      m.addTo(capaMarcadores);
      marcadores.set(e.id, m);
    });
    if (!ajustarVista) return;
    if (estado.resultados.length) {
      const b = L.latLngBounds(estado.resultados.slice(0, 25).map((e) => [e.lat, e.lon]).concat([[o.lat, o.lon]]));
      mapa.fitBounds(b, { padding: [50, 50], maxZoom: 15 });
    } else mapa.setView([o.lat, o.lon], 12);
  }

  const textoDistancia = (e) => e.ruta
    ? `${fmtKm(e.ruta.km)} · ${Math.max(1, Math.round(e.ruta.min))} min en coche`
    : `${fmtKm(e.distancia)} en línea recta`;

  function popupHTML(e) {
    return `<div class="pop"><h4 class="pop-marca">${GR.logoHTML(e.rotulo, "mini")}${esc(e.rotulo)}</h4><p>${esc(e.direccion)}, ${esc(e.municipio)}<br>${textoDistancia(e)}</p>
      <div class="precio ${nivel(e.precio)}">${fmtPrecio(e.precio)} <small>€/L</small></div>
      <a class="btn btn-maps btn-peq" href="${GR.urlMaps(e, estado.origen)}" target="_blank" rel="noopener">${icono("ruta")}Abrir en Google Maps</a></div>`;
  }

  /* ---------- Combustibles y filtros ---------- */
  function pintarChips() {
    $("#chips-combustible").innerHTML = GR.COMBUSTIBLES.map(
      (c) => `<button type="button" class="chip ${c.id === estado.combustible ? "activo" : ""}" data-c="${c.id}">${c.nombre}</button>`
    ).join("");
  }
  $("#chips-combustible").addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip"); if (!b) return;
    estado.combustible = b.dataset.c; GR.guardar("combustible", estado.combustible);
    pintarChips(); if (estado.origen) calcular();
  });

  const radioIn = $("#radio");
  radioIn.value = estado.radio; $("#radio-val").textContent = estado.radio + " km";
  radioIn.addEventListener("input", () => { $("#radio-val").textContent = radioIn.value + " km"; });
  radioIn.addEventListener("change", () => { estado.radio = +radioIn.value; GR.guardar("radio", estado.radio); if (estado.origen) calcular(); });

  document.querySelectorAll(".orden button").forEach((b) =>
    b.addEventListener("click", () => {
      estado.orden = b.dataset.orden;
      document.querySelectorAll(".orden button").forEach((x) => x.classList.toggle("activo", x === b));
      ordenar(); pintarLista();
    })
  );

  /* ---------- Datos ---------- */
  const datos = () => GR.datos();

  async function buscarDesde(origen, mantenerVista = false) {
    estado.origen = origen;
    GR.guardar("ultimoOrigen", { ...origen, provisional: undefined });
    pintarOrigen();
    if (!origen.direccionReal && (origen.nombre === "Tu ubicación" || origen.nombre === "Punto elegido en el mapa")) {
      GR.direccionDe(origen.lat, origen.lon).then((d) => { if (d && estado.origen === origen) { origen.direccionReal = d; pintarOrigen(); GR.guardar("ultimoOrigen", { ...origen, provisional: undefined }); } });
    }
    if (!mantenerVista) $("#lista").innerHTML = '<div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto"></div>';
    $("#cuenta").textContent = "Descargando precios oficiales...";
    try {
      const total = datos();
      // si el listado completo no está ya disponible, se empieza con las provincias cercanas (descarga pequeña)
      let d = await Promise.race([total.catch(() => null), new Promise((r) => setTimeout(() => r(null), 150))]);
      if (!d) {
        const zona = GR.estacionesZona(origen.lat, origen.lon).catch(() => total);
        d = await Promise.race([total.catch(() => zona), zona]);
      }
      if (estado.origen !== origen) return; // mientras tanto se ha elegido otro punto
      datosVista = d;
      const pintado = !d.parcial || hayEnRadio(d);
      if (pintado) calcular(mantenerVista);
      if (d.parcial) {
        try {
          const t = await total;
          if (datosVista === d) { datosVista = t; if (estado.origen) calcular(pintado ? true : mantenerVista); }
        } catch (err) {
          if (!pintado) throw err;
          console.warn("No llegó el listado completo; se mantienen las gasolineras de la zona:", err);
        }
      }
    } catch (err) {
      console.error(err);
      $("#lista").innerHTML = `<div class="vacio"><div class="icono-grande">${icono("info")}</div><h3>No se pudieron descargar los precios</h3>
        <p>El servicio del Ministerio no responde ahora mismo o el navegador ha bloqueado la petición. Inténtalo de nuevo en unos minutos.</p>
        <p style="margin-top:14px"><button class="btn btn-sec btn-peq" id="reintentar">Reintentar</button></p></div>`;
      $("#cuenta").textContent = "Error al cargar";
      $("#reintentar").onclick = () => buscarDesde(origen);
    }
  }

  /* Datos que se están pintando: el listado completo o, mientras llega, el de las provincias cercanas */
  let datosVista = null;
  function hayEnRadio(d) {
    const o = estado.origen, c = estado.combustible;
    return d.estaciones.some((e) => e.precios[c] && GR.distanciaKm(o.lat, o.lon, e.lat, e.lon) <= estado.radio);
  }
  // precios nuevos descargados en segundo plano: se repinta sin mover el mapa
  window.addEventListener("datosactualizados", (ev) => {
    if (!datosVista) return;
    datosVista = ev.detail;
    if (estado.origen) calcular(true);
  });

  function pintarOrigen() {
    const o = estado.origen, el = $("#origen-txt");
    if (!o) { el.classList.add("oculto"); return; }
    const nombre = o.direccionReal || (o.nombre || "").split(",").slice(0, 3).join(",");
    let h = `${icono("pin")}<span>Buscando desde <b>${esc(nombre)}</b>`;
    if (o.provisional) h += ` <em class="impreciso">(aproximada, afinando tu ubicación...)</em>`;
    else if (o.porIP) h += ` <em class="impreciso">(aproximada por tu conexión a internet)</em>`;
    else if (o.precision && o.precision > 300) h += ` <em class="impreciso">(ubicación aproximada, ±${fmtKm(o.precision / 1000)})</em>`;
    h += `. Si no es correcto, arrastra el punto azul del mapa o escribe tu dirección.</span>`;
    el.innerHTML = h; el.classList.remove("oculto");
  }

  let turnoRutas = 0;
  function calcular(mantenerVista = false) {
    Promise.resolve(datosVista || datos()).then((dat) => {
      const o = estado.origen, c = estado.combustible;
      const lista = [];
      for (const e of dat.estaciones) {
        const p = e.precios[c]; if (!p) continue;
        if (Math.abs(e.lat - o.lat) > estado.radio / 100 + 0.1) continue; // descarte rápido
        const dist = GR.distanciaKm(o.lat, o.lon, e.lat, e.lon);
        if (dist <= estado.radio) lista.push({ ...e, precio: p, distancia: dist, ruta: null });
      }
      estado.resultados = lista;
      estado.mostrar = 40;
      const precios = lista.map((e) => e.precio).sort((a, b) => a - b);
      estado.cortes = [precios[Math.floor(precios.length / 3)] ?? 0, precios[Math.floor((precios.length * 2) / 3)] ?? 0];
      estado.media = precios.length ? precios.reduce((s, p) => s + p, 0) / precios.length : null;
      ordenar(); pintarStats(precios); pintarLista(); pintarMapa(!mantenerVista); guardarResumen(precios);
      calcularRutas(precios);
    });
  }

  /* Distancias reales por carretera para las gasolineras que se muestran */
  async function calcularRutas(precios) {
    const turno = ++turnoRutas, o = estado.origen;
    const r = estado.resultados;
    if (!r.length) return;
    const cercanas = [...r].sort((a, b) => a.distancia - b.distancia).slice(0, 120);
    const baratas = [...r].sort((a, b) => a.precio - b.precio).slice(0, 60);
    const objetivo = [...new Map([...cercanas, ...baratas].map((e) => [e.id, e])).values()];
    estado.rutas = "calculando"; pintarEstadoRutas();
    try {
      const res = await GR.distanciasCarretera(o, objetivo);
      if (turno !== turnoRutas) return;
      objetivo.forEach((e, i) => { if (res[i]) { e.ruta = res[i]; } });
      estado.rutas = "ok";
    } catch (err) {
      console.warn("Distancias por carretera no disponibles:", err);
      if (turno !== turnoRutas) return;
      estado.rutas = "error";
    }
    ordenar(); pintarStats(precios); pintarLista(); pintarEstadoRutas(); guardarResumen(precios);
    if (!modoGoogle) pintarMapa(false);
  }
  function pintarEstadoRutas() {
    const el = $("#rutas-estado");
    const txt = {
      calculando: '<span class="spinner peq"></span>Calculando distancias por carretera...',
      ok: `${icono("ruta")}Distancias y tiempos reales por carretera (${GR.fuenteDistancias()})`,
      error: `${icono("info")}No se pudo calcular la ruta por carretera; se muestran distancias en línea recta`,
    }[estado.rutas];
    el.innerHTML = txt || ""; el.className = "rutas-estado " + estado.rutas;
  }

  const kmDe = (e) => (e.ruta ? e.ruta.km : e.distancia * 1.3); // sin ruta, estimamos que la carretera es un 30% más larga
  function ordenar() {
    const r = estado.resultados;
    if (estado.orden === "precio") r.sort((a, b) => a.precio - b.precio || kmDe(a) - kmDe(b));
    else r.sort((a, b) => kmDe(a) - kmDe(b));
  }

  function guardarResumen(precios) {
    if (!precios.length) return;
    const barata = estado.resultados.reduce((m, e) => (e.precio < m.precio || (e.precio === m.precio && kmDe(e) < kmDe(m)) ? e : m));
    GR.guardar("ultimaBusqueda", {
      combustible: estado.combustible, barata: precios[0], media: estado.media, cara: precios[precios.length - 1],
      estacionBarata: barata.rotulo + " - " + barata.municipio, distanciaBarata: kmDe(barata),
      lat: estado.origen.lat, lon: estado.origen.lon, nombre: estado.origen.direccionReal || estado.origen.nombre, radio: estado.radio, fecha: Date.now(),
    });
    const recientes = [...estado.resultados].sort((a, b) => kmDe(a) - kmDe(b)).slice(0, 25)
      .map(({ id, rotulo, direccion, municipio, idMunicipio, lat, lon, precios }) => ({ id, rotulo, direccion, municipio, idMunicipio, lat, lon, precios }));
    GR.guardar("recientes", recientes);
  }

  /* ---------- Pintado ---------- */
  function pintarStats(precios) {
    const r = estado.resultados;
    if (!r.length) { ["barata", "media", "cerca", "ahorro"].forEach((k) => { $("#st-" + k).textContent = "--"; }); return; }
    const barata = r.reduce((m, e) => (e.precio < m.precio || (e.precio === m.precio && kmDe(e) < kmDe(m)) ? e : m));
    const cerca = r.reduce((m, e) => (kmDe(e) < kmDe(m) ? e : m));
    $("#st-barata").innerHTML = `${fmtPrecio(barata.precio)} <small>€/L</small>`;
    $("#st-barata-d").textContent = `${barata.rotulo} · ${fmtKm(barata.ruta ? barata.ruta.km : barata.distancia)}`;
    $("#st-media").innerHTML = `${fmtPrecio(estado.media)} <small>€/L</small>`;
    $("#st-media-d").textContent = `${r.length} gasolineras en ${estado.radio} km`;
    $("#st-cerca").innerHTML = cerca.ruta ? `${fmtKm(cerca.ruta.km)} <small>${Math.max(1, Math.round(cerca.ruta.min))} min</small>` : fmtKm(cerca.distancia);
    $("#st-cerca-d").textContent = `${cerca.rotulo} · ${fmtPrecio(cerca.precio)} €/L`;
    $("#st-ahorro").textContent = fmtEuros((precios[precios.length - 1] - precios[0]) * 50);
  }

  function tarjetaHTML(e, i) {
    const dif = e.precio - estado.media;
    const difTxt = Math.abs(dif) < 0.0005 ? "En la media" : `${dif < 0 ? "-" : "+"}${fmtPrecio(Math.abs(dif))} € vs media`;
    const fav = GR.favoritos.es(e.id);
    const nota = GR.opiniones.media(e.id);
    const etiqueta = i === 0 ? (estado.orden === "precio" ? "La más barata" : "La más cercana") : "";
    return `<article class="tarjeta ${estado.seleccionado === e.id ? "sel" : ""}" data-id="${e.id}" style="--i:${Math.min(i % 40, 10)}">
      ${etiqueta ? `<span class="insignia">${etiqueta}</span>` : ""}
      <div>
        <div class="marca">${GR.logoHTML(e.rotulo)}${esc(e.rotulo)}</div>
        <div class="dir">${esc(e.direccion)}, ${esc(e.municipio)}</div>
        <div class="meta">
          <span class="${e.ruta ? "dist-ruta" : ""}">${icono(e.ruta ? "ruta" : "pin")}${textoDistancia(e)}</span>
          <span title="${esc(e.horario)}">${icono("reloj")}${esc(e.horario.length > 26 ? e.horario.slice(0, 26) + "..." : e.horario || "Sin horario")}</span>
          ${nota ? `<span>${GR.estrellasHTML(nota)} ${nota.toFixed(1).replace(".", ",")}</span>` : ""}
        </div>
      </div>
      <div class="precio-caja">
        <div class="precio ${nivel(e.precio)}">${fmtPrecio(e.precio)}<small> €/L</small></div>
        <div class="dif ${dif < -0.0005 ? "neg" : dif > 0.0005 ? "pos" : ""}">${difTxt}</div>
      </div>
      <div class="acciones">
        <a class="btn btn-maps btn-peq" href="${GR.urlMaps(e, estado.origen)}" target="_blank" rel="noopener" data-stop>${icono("ruta")}Cómo llegar</a>
        <a class="btn btn-fantasma btn-peq" href="opiniones.html?estacion=${encodeURIComponent(e.id)}" data-stop>${icono("chat")}Opiniones</a>
        <button type="button" class="btn btn-fantasma btn-peq btn-comp ${GR.comparar.tiene(e.id) ? "on" : ""}" data-comp="${e.id}" data-stop>${icono("comparar")}${GR.comparar.tiene(e.id) ? "En comparador" : "Comparar"}</button>
        <button type="button" class="btn btn-fantasma btn-peq btn-fav ${fav ? "on" : ""}" data-fav="${e.id}" data-stop>${icono("estrella")}${fav ? "Guardada" : "Favorita"}</button>
      </div>
    </article>`;
  }

  function pintarLista() {
    const r = estado.resultados, l = $("#lista");
    $("#cuenta").textContent = `${r.length} resultados · ${GR.combustible(estado.combustible).nombre}`;
    if (!r.length) {
      l.innerHTML = `<div class="vacio"><div class="icono-grande">${icono("buscar")}</div><h3>No hay gasolineras en ${estado.radio} km</h3>
        <p>Prueba a ampliar el radio de búsqueda o a cambiar de combustible.</p>
        <p style="margin-top:14px"><button class="btn btn-primario btn-peq" id="ampliar">Ampliar a ${Math.min(50, estado.radio * 2)} km</button></p></div>`;
      $("#ampliar").onclick = () => { estado.radio = Math.min(50, estado.radio * 2); radioIn.value = estado.radio; $("#radio-val").textContent = estado.radio + " km"; calcular(); };
      return;
    }
    let h = r.slice(0, estado.mostrar).map(tarjetaHTML).join("");
    if (r.length > estado.mostrar) h += `<button class="btn btn-sec" id="ver-mas">Ver ${Math.min(40, r.length - estado.mostrar)} más</button>`;
    l.innerHTML = h;
    const vm = $("#ver-mas"); if (vm) vm.onclick = () => { estado.mostrar += 40; pintarLista(); };
  }

  $("#lista").addEventListener("click", (ev) => {
    const comp = ev.target.closest("[data-comp]");
    if (comp) {
      const e = estado.resultados.find((x) => x.id === comp.dataset.comp);
      const r = GR.comparar.alternar(e);
      if (r === null) { GR.toast("Comparador lleno", "Puedes comparar hasta 4 gasolineras. Quita alguna en el comparador.", "alerta"); return; }
      comp.classList.toggle("on", r);
      comp.innerHTML = icono("comparar") + (r ? "En comparador" : "Comparar");
      const n = GR.comparar.todas().length;
      GR.toast(r ? "Añadida al comparador" : "Quitada del comparador", `${n} de 4 gasolineras. Ábrelo en el menú: Comparador.`, r ? "ok" : "");
      return;
    }
    const fav = ev.target.closest("[data-fav]");
    if (fav) {
      const e = estado.resultados.find((x) => x.id === fav.dataset.fav);
      const on = GR.favoritos.alternar(e);
      fav.classList.toggle("on", on);
      fav.innerHTML = icono("estrella") + (on ? "Guardada" : "Favorita");
      GR.toast(on ? "Añadida a favoritos" : "Quitada de favoritos", e.rotulo + ", " + e.municipio, on ? "ok" : "");
      return;
    }
    if (ev.target.closest("[data-stop]")) return;
    const t = ev.target.closest(".tarjeta"); if (!t) return;
    if (esMovil()) ponerVista("mapa");
    seleccionar(t.dataset.id, true);
  });

  function seleccionar(id, desdeLista) {
    estado.seleccionado = id;
    document.querySelectorAll(".tarjeta").forEach((t) => t.classList.toggle("sel", t.dataset.id === id));
    document.querySelectorAll(".marcador").forEach((m) => m.classList.toggle("sel", m.dataset.id === id));
    if (modoGoogle) { centrarGoogle(estado.resultados.find((e) => e.id === id)); return; }
    const m = marcadores.get(id);
    if (m && desdeLista && mapa) { mapa.flyTo(m.getLatLng(), Math.max(mapa.getZoom(), 15), { duration: 0.6 }); setTimeout(() => m.openPopup(), 650); }
    if (!desdeLista) {
      let t = document.querySelector(`.tarjeta[data-id="${CSS.escape(id)}"]`);
      if (!t) { const idx = estado.resultados.findIndex((e) => e.id === id); if (idx >= 0) { estado.mostrar = idx + 10; pintarLista(); t = document.querySelector(`.tarjeta[data-id="${CSS.escape(id)}"]`); } }
      if (t) t.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /* ---------- Ubicación y dirección ---------- */
  let turnoUbicacion = 0;
  function avisarImprecisa(p) {
    if (p.porIP) GR.toast("Ubicación aproximada", "Tu navegador no nos ha dado la ubicación exacta, así que te situamos por tu conexión a internet. Escribe tu dirección o arrastra el punto azul del mapa para afinar.", "alerta", 9000);
    else if (p.precision > 1500) GR.toast("Ubicación aproximada", `Tu navegador solo sabe dónde estás con un margen de ${fmtKm(p.precision / 1000)}. Para distancias exactas escribe tu dirección o arrastra el punto azul del mapa.`, "alerta", 9000);
  }
  async function usarUbicacion(forzar = false) {
    const b = $("#btn-ubicacion"), turno = ++turnoUbicacion;
    const listo = () => { if (turno === turnoUbicacion) { b.disabled = false; b.lastChild.textContent = " Mi ubicación"; } };
    b.disabled = true; b.lastChild.textContent = " Localizando...";
    datos().catch(() => {});
    // Si el navegador tarda, se empieza con la posición aproximada y, cuando llega la buena, se actualiza sola
    const alMejorar = (mejor) => {
      const o = estado.origen;
      if (turno !== turnoUbicacion || !o || !o.provisional) return; // la persona ya ha elegido otro punto
      if (mejor && !mejor.porIP) { avisarImprecisa(mejor); buscarDesde({ ...mejor, nombre: "Tu ubicación" }); return; }
      delete o.provisional; pintarOrigen(); avisarImprecisa(o);
    };
    let p;
    try {
      p = await GR.pedirUbicacion({ forzar: forzar === true, alMejorar });
    } catch (err) {
      listo();
      GR.toast("No pudimos obtener tu ubicación", err.message + " Mientras tanto, puedes escribir tu dirección.", "error", 12000);
      $("#direccion").focus();
      return;
    }
    listo();
    GR.guardar("prefUbicacion", "si");
    $("#direccion").value = "";
    if (!p.provisional) avisarImprecisa(p);
    await buscarDesde({ ...p, nombre: "Tu ubicación" });
  }
  $("#btn-ubicacion").addEventListener("click", () => usarUbicacion(true));

  let temporizador = null, sugeridas = [];
  const sug = $("#sugerencias");
  $("#direccion").addEventListener("input", (ev) => {
    clearTimeout(temporizador);
    const q = ev.target.value.trim();
    if (q.length < 3) { sug.classList.add("oculto"); return; }
    temporizador = setTimeout(async () => {
      try {
        sugeridas = await GR.geocodificar(q);
        if (!sugeridas.length) { sug.classList.add("oculto"); return; }
        sug.innerHTML = sugeridas.map((s, i) => `<button type="button" data-i="${i}">${esc(s.nombre)}</button>`).join("");
        sug.classList.remove("oculto");
      } catch { sug.classList.add("oculto"); }
    }, 450);
  });
  sug.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    const s = sugeridas[+b.dataset.i];
    $("#direccion").value = s.nombre.split(",").slice(0, 3).join(",");
    sug.classList.add("oculto");
    buscarDesde({ ...s, exacto: true });
  });
  document.addEventListener("click", (ev) => { if (!ev.target.closest(".campo-dir")) sug.classList.add("oculto"); });

  $("#form-buscar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    sug.classList.add("oculto");
    const q = $("#direccion").value.trim();
    if (!q) { if (estado.origen) calcular(); else usarUbicacion(); return; }
    datos().catch(() => {});
    try {
      const r = await GR.geocodificar(q);
      if (!r.length) { GR.toast("Dirección no encontrada", "Prueba con otra dirección, ciudad o código postal.", "error"); return; }
      buscarDesde({ ...r[0], exacto: true });
    } catch { GR.toast("Error de búsqueda", "No se pudo localizar la dirección. Revisa tu conexión.", "error"); }
  });

  /* ---------- Ventana de ubicación ---------- */
  function preguntarUbicacion() {
    const pref = GR.leer("prefUbicacion", null);
    if (pref === "si") { usarUbicacion(); return; }
    if (pref === "no") {
      const u = GR.leer("ultimoOrigen", null);
      if (u) { $("#direccion").value = (u.direccionReal || u.nombre || "").split(",").slice(0, 3).join(","); buscarDesde(u); }
      return;
    }
    const m = $("#modal-ubicacion");
    m.classList.remove("oculto");
    $("#modal-si").onclick = () => { m.classList.add("oculto"); usarUbicacion(); };
    $("#modal-no").onclick = () => { m.classList.add("oculto"); GR.guardar("prefUbicacion", "no"); $("#direccion").focus(); datos().catch(() => {}); };
  }

  /* ---------- Inicio ---------- */
  pintarChips();
  iniciarMapa();
  const esPaginaMapa = document.body.dataset.pagina === "mapa";
  if (esPaginaMapa && esMovil()) ponerVista("mapa");
  const params = new URLSearchParams(location.search);
  if (params.get("ubicacion") === "1") usarUbicacion();
  else if (params.get("q")) {
    $("#direccion").value = params.get("q");
    $("#form-buscar").requestSubmit();
  } else preguntarUbicacion();
})();
