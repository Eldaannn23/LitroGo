/* ==========================================================
   LitroGo - apartados: inicio, comparador, ahorro, estadísticas, favoritos, alertas, cuenta y opiniones
   ========================================================== */
(() => {
  const { icono, esc, fmtPrecio, fmtEuros, fmtKm } = GR;
  const $ = (s) => document.querySelector(s);
  const { opcionesComb, opcionesEstaciones, estacionesConocidas } = GR;
  const combPref = GR.leer("combustible", "g95");
  const datos = () => GR.datos();
  const iniciadas = new Set();

  /* ======================= CALCULADORA =======================
     "Precio en la más barata" se rellena solo con la gasolinera más barata que hay
     cerca de la persona (por su ubicación o, si no la comparte, su última búsqueda). */
  let origenCalc = null, turnoCalc = 0;
  function initCalculadora() {
    $("#c-comb").innerHTML = opcionesComb(combPref);
    const ids = ["c-habitual", "c-barata", "c-litros", "c-veces", "c-desvio", "c-consumo"];
    ids.forEach((id) => $("#" + id).addEventListener("input", calcularAhorro));
    $("#c-habitual").addEventListener("input", () => GR.guardar("calcHabitualManual", true));
    $("#c-comb").addEventListener("change", () => buscarBarataCerca(false));
    $("#c-cargar").innerHTML = `${icono("mira")}Actualizar con mi ubicación`;
    $("#c-cargar").addEventListener("click", () => buscarBarataCerca(true));
    const guard = GR.leer("calc", null);
    const pf = GR.perfil.leer();
    if (guard) ids.forEach((id) => { if (guard[id] != null) $("#" + id).value = guard[id]; });
    // el consumo y el depósito salen siempre del vehículo de Mi cuenta
    $("#c-consumo").value = pf.consumo; $("#c-litros").value = pf.deposito;
    $("#c-vehiculo").textContent = `Vehículo: ${pf.vehiculo}, ${String(pf.consumo).replace(".", ",")} L/100 km y depósito de ${pf.deposito} L (cámbialo en Mi cuenta).`;
    calcularAhorro();
    buscarBarataCerca(false);
  }

  async function buscarBarataCerca(pulsado) {
    const turno = ++turnoCalc, info = $("#c-barata-info");
    const cargando = (t) => { info.innerHTML = `<div class="bc-cargando"><span class="spinner peq"></span>${t}</div>`; };
    datos().catch(() => {}); // los precios se descargan mientras se busca la ubicación
    if (pulsado || !origenCalc) {
      let o = null;
      const pref = GR.leer("prefUbicacion", null);
      if (pulsado || pref !== "no") {
        cargando("Buscando tu ubicación...");
        try {
          const p = await GR.pedirUbicacion({ forzar: pulsado });
          o = { ...p, nombre: "Tu ubicación" };
          if (pulsado) GR.guardar("prefUbicacion", "si");
        } catch (err) { if (pulsado) GR.toast("No se pudo obtener tu ubicación", err.message || "", "alerta", 9000); }
      }
      if (turno !== turnoCalc) return;
      o = o || GR.leer("ultimoOrigen", null);
      if (!o) { info.innerHTML = `<p class="bc-vacio">Pulsa "Actualizar con mi ubicación" para poner aquí la gasolinera más barata que tengas cerca.</p>`; return; }
      origenCalc = o;
    }
    const o = origenCalc, comb = $("#c-comb").value, nomComb = GR.combustible(comb).nombre;
    cargando(`Buscando la ${nomComb} más barata cerca de ti...`);
    let d;
    try { d = await datos(); }
    catch { if (turno === turnoCalc) info.innerHTML = '<p class="bc-vacio">No se pudieron descargar los precios oficiales. Inténtalo de nuevo en unos minutos.</p>'; return; }
    if (turno !== turnoCalc) return;
    const radio = Math.max(5, GR.leer("radio", 10));
    const todas = d.estaciones.filter((e) => e.precios[comb]).map((e) => ({ e, p: e.precios[comb], k: GR.distanciaKm(o.lat, o.lon, e.lat, e.lon) }));
    let cerca = todas.filter((x) => x.k <= radio), radioUsado = radio;
    if (cerca.length < 3) { cerca = todas.sort((a, b) => a.k - b.k).slice(0, 10); radioUsado = cerca.length ? Math.ceil(cerca[cerca.length - 1].k) : radio; }
    if (!cerca.length) { info.innerHTML = `<p class="bc-vacio">No hay gasolineras con ${esc(nomComb)} cerca de ti.</p>`; return; }
    const min = cerca.reduce((m, x) => (x.p < m.p || (x.p === m.p && x.k < m.k) ? x : m));
    const media = cerca.reduce((s, x) => s + x.p, 0) / cerca.length;
    $("#c-barata").value = min.p.toFixed(3);
    if (!GR.leer("calcHabitualManual", false)) $("#c-habitual").value = media.toFixed(3);
    let km = min.k, minutos = null;
    const pintar = () => {
      const e = min.e;
      info.innerHTML = `<div class="bc-tarjeta">
        ${GR.logoHTML(e.rotulo, "grande")}
        <div class="bc-info"><span class="bc-etq">La más barata cerca de ti</span><b>${esc(e.rotulo)}</b><small>${esc(e.direccion)}, ${esc(e.municipio)}</small>
          <span class="bc-dist">${icono("ruta")}${fmtKm(km)}${minutos != null ? ` · ${Math.max(1, Math.round(minutos))} min` : " en línea recta"}</span></div>
        <div class="bc-precio"><strong>${fmtPrecio(min.p)}</strong><small>€/L</small><a href="${GR.urlMaps(e, o)}" target="_blank" rel="noopener">Cómo llegar</a></div>
      </div>`;
      const desde = o.nombre === "Tu ubicación" ? (o.porIP ? "tu ubicación aproximada" : "tu ubicación") : (o.direccionReal || o.nombre || "tu última búsqueda").split(",")[0];
      $("#c-origen").textContent = `Entre ${cerca.length} gasolineras con ${nomComb} a menos de ${radioUsado} km de ${desde}. ${GR.leer("calcHabitualManual", false) ? "" : "Como gasolinera habitual se usa el precio medio de la zona: cámbialo por el de la tuya. "}El desvío es la ida y vuelta hasta ella.`;
    };
    $("#c-desvio").value = Math.max(0, Math.round(km * 2 * 2) / 2);
    pintar(); calcularAhorro();
    try {
      const [r] = await GR.distanciasCarretera(o, [min.e]);
      if (r && turno === turnoCalc) { km = r.km; minutos = r.min; $("#c-desvio").value = Math.max(0, Math.round(km * 2 * 2) / 2); pintar(); calcularAhorro(); }
    } catch {}
  }
  function calcularAhorro() {
    const v = (id) => parseFloat($("#" + id).value) || 0;
    const hab = v("c-habitual"), bar = v("c-barata"), litros = v("c-litros"), veces = v("c-veces"), desvio = v("c-desvio"), consumo = v("c-consumo");
    GR.guardar("calc", Object.fromEntries(["c-habitual", "c-barata", "c-litros", "c-veces", "c-desvio", "c-consumo"].map((id) => [id, $("#" + id).value])));
    const porRep = (hab - bar) * litros;
    const costeDesvioRep = (desvio * consumo) / 100 * bar;
    const netoMes = (porRep - costeDesvioRep) * veces;
    const anual = netoMes * 12;
    $("#r-anual").textContent = fmtEuros(anual);
    $("#r-mes").textContent = fmtEuros(netoMes);
    $("#r-rep").textContent = fmtEuros(porRep - costeDesvioRep);
    $("#r-desvio").textContent = fmtEuros(costeDesvioRep * veces);
    const frase = $("#r-frase");
    if (anual > 0) frase.textContent = `Equivale a unos ${Math.floor(anual / (bar * litros) * 10) / 10} depósitos gratis al año.`.replace(".", ",").replace(/,$/, ".");
    else if (hab <= bar) frase.textContent = "Tu gasolinera habitual ya es igual o más barata. No compensa cambiar.";
    else frase.textContent = "El desvío cuesta más de lo que ahorras: no compensa ir a la más barata.";
    const gastoHab = hab * litros * veces, gastoBar = bar * litros * veces + costeDesvioRep * veces;
    const max = Math.max(gastoHab, gastoBar, 1);
    $("#b-hab").style.width = (gastoHab / max) * 100 + "%"; $("#b-hab-v").textContent = fmtEuros(gastoHab, 0);
    $("#b-bar").style.width = (gastoBar / max) * 100 + "%"; $("#b-bar-v").textContent = fmtEuros(gastoBar, 0);
  }

  /* ======================= FAVORITOS ======================= */
  async function pintarFavoritos() {
    const cont = $("#lista-favoritos");
    const favs = GR.favoritos.todos();
    if (!favs.length) {
      cont.innerHTML = `<div class="vacio"><div class="icono-grande">${icono("estrella")}</div><h3>Aún no tienes favoritas</h3><p>En el buscador, pulsa "Favorita" en cualquier gasolinera para tenerla siempre a mano aquí.</p></div>`;
      return;
    }
    let actuales = new Map();
    try { const d = await datos(); const ids = new Set(favs.map((f) => f.id)); d.estaciones.forEach((e) => ids.has(e.id) && actuales.set(e.id, e)); } catch {}
    const origen = GR.leer("ultimoOrigen", null);
    cont.innerHTML = favs.map((f) => {
      const e = actuales.get(f.id) || f;
      const nota = GR.opiniones.media(f.id);
      const pills = GR.COMBUSTIBLES.filter((c) => e.precios[c.id]).map((c) => {
        const antes = f.precios?.[c.id], ahora = e.precios[c.id];
        const clase = antes && ahora < antes - 0.0005 ? "ok" : antes && ahora > antes + 0.0005 ? "warn" : "";
        return `<span class="pill ${clase}">${c.nombre} <b>${fmtPrecio(ahora)}</b></span>`;
      }).join("");
      const dist = origen ? " · a " + fmtKm(GR.distanciaKm(origen.lat, origen.lon, f.lat, f.lon)) + " en línea recta de tu última búsqueda" : "";
      return `<div class="item">
        ${GR.logoHTML(f.rotulo, "grande")}
        <div><h4>${esc(f.rotulo)} ${nota ? GR.estrellasHTML(nota) : ""}</h4><p>${esc(f.direccion)}, ${esc(f.municipio)}${dist}</p><div class="precios">${pills || '<span class="pill">Sin precios disponibles</span>'}</div></div>
        <div class="der">
          <a class="btn btn-maps btn-peq" href="${GR.urlMaps(f)}" target="_blank" rel="noopener">${icono("ruta")}Cómo llegar</a>
          <a class="btn btn-sec btn-peq" href="estadisticas.html" data-hist="${esc(f.id)}">${icono("grafica")}Historial</a>
          <button class="btn btn-fantasma btn-peq" data-quitar="${esc(f.id)}" aria-label="Quitar de favoritos">${icono("papelera")}</button>
        </div></div>`;
    }).join("") + `<p class="ayuda">En verde, los precios que han bajado desde que guardaste la gasolinera; en ámbar, los que han subido.</p>`;
  }
  function initFavoritos() {
    $("#lista-favoritos").addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-quitar]");
      if (q) { GR.favoritos.quitar(q.dataset.quitar); GR.toast("Quitada de favoritos", "", ""); pintarFavoritos(); return; }
      const h = ev.target.closest("[data-hist]");
      if (h) GR.guardar("histSel", h.dataset.hist);
    });
    pintarFavoritos();
  }

  /* ======================= HISTORIAL ======================= */
  const fechaApi = (d) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  const fechaCorta = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  let pedidoHist = 0;

  function initHistorial() {
    $("#h-comb").innerHTML = opcionesComb(combPref);
    ["h-est", "h-comb", "h-dias"].forEach((id) => $("#" + id).addEventListener("change", cargarHistorial));
    window.addEventListener("resize", () => ultimaSerie && dibujar(ultimaSerie));
    window.addEventListener("cambiotema", () => ultimaSerie && dibujar(ultimaSerie));
    refrescarHistorial();
    GR.mejorarSelector($("#h-est"));
    window.addEventListener("cercanascargadas", refrescarHistorial);
    GR.cargarCercanas();
  }
  function refrescarHistorial() {
    const sel = GR.leer("histSel", null) || $("#h-est").value;
    $("#h-est").innerHTML = opcionesEstaciones(sel);
    cargarHistorial();
  }

  async function cargarHistorial() {
    const id = $("#h-est").value, comb = $("#h-comb").value, dias = +$("#h-dias").value;
    const yo = ++pedidoHist;
    const est = estacionesConocidas().find((e) => e.id === id);
    if (!est) { dibujar(null, "Guarda gasolineras como favoritas o haz una búsqueda para ver su historial."); return; }
    GR.guardar("histSel", id);
    $("#h-estado").classList.remove("oculto");
    const hoy = new Date();
    const fechas = [];
    for (let i = dias - 1; i >= 1; i--) { const d = new Date(hoy); d.setDate(d.getDate() - i); fechas.push(d); }
    const puntos = [];
    let fallos = 0;
    // descargas en paralelo, de 4 en 4
    for (let i = 0; i < fechas.length; i += 4) {
      const lote = fechas.slice(i, i + 4);
      const res = await Promise.all(lote.map((f) => GR.historicoMunicipio(fechaApi(f), est.idMunicipio).catch(() => null)));
      if (yo !== pedidoHist) return;
      res.forEach((lista, j) => {
        if (!lista) { fallos++; return; }
        puntos.push(puntoDe(lote[j], lista, id, comb));
      });
    }
    try {
      const d = await datos();
      if (yo !== pedidoHist) return;
      puntos.push(puntoDe(hoy, d.estaciones.filter((e) => e.idMunicipio === est.idMunicipio), id, comb));
    } catch {}
    // Respaldo: precios registrados por LitroGo en este navegador
    if (fallos === fechas.length) {
      const local = GR.leer("historial", {})[id] || {};
      Object.entries(local).forEach(([k, pr]) => {
        const f = new Date(k + "T12:00:00");
        if (hoy - f <= dias * 86400000 && !puntos.some((p) => p.clave === k)) puntos.push({ fecha: f, clave: k, precio: pr[comb] ?? null, media: null });
      });
      GR.toast("Histórico oficial no disponible", "Mostramos los precios que LitroGo ha registrado en este navegador.", "alerta");
    }
    puntos.sort((a, b) => a.fecha - b.fecha);
    $("#h-estado").classList.add("oculto");
    dibujar(puntos.filter((p) => p.precio || p.media));
  }
  function puntoDe(fecha, lista, id, comb) {
    const e = lista.find((x) => x.id === id);
    const pr = lista.map((x) => x.precios[comb]).filter(Boolean);
    return { fecha, clave: fecha.toISOString().slice(0, 10), precio: e?.precios[comb] ?? null, media: pr.length ? pr.reduce((s, p) => s + p, 0) / pr.length : null };
  }

  let ultimaSerie = null;
  function dibujar(serie, mensaje) {
    ultimaSerie = serie;
    const svg = $("#grafica");
    const W = Math.max(320, svg.clientWidth || 800), H = 320;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.removeAttribute("preserveAspectRatio");
    const cAc = GR.colorTema("--acento") || "#00b86b", cAz = GR.colorTema("--azul") || "#2563eb", cRej = GR.colorTema("--borde") || "rgba(0,0,0,.08)", cTx = GR.colorTema("--texto-3") || "#86948e", cFondo = GR.colorTema("--card") || "#fff";
    ["h-hoy", "h-min", "h-max", "h-var"].forEach((k) => ($("#" + k).textContent = "--"));
    if (!serie || serie.length < 1) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${cTx}" font-size="14">${esc(mensaje || "No hay datos para este combustible en el periodo elegido.")}</text>`;
      return;
    }
    const valores = serie.flatMap((p) => [p.precio, p.media]).filter(Boolean);
    let min = Math.min(...valores), max = Math.max(...valores);
    const pad = Math.max(0.01, (max - min) * 0.2); min -= pad; max += pad;
    const m = { l: 56, r: 18, t: 18, b: 34 };
    const x = (i) => m.l + (serie.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (serie.length - 1));
    const y = (v) => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
    let h = `<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cAc}" stop-opacity="0.25"/><stop offset="1" stop-color="${cAc}" stop-opacity="0"/></linearGradient></defs>`;
    for (let k = 0; k <= 4; k++) {
      const v = min + ((max - min) * k) / 4, yy = y(v);
      h += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="${cRej}"/><text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" fill="${cTx}" font-size="11">${fmtPrecio(v)}</text>`;
    }
    const paso = Math.ceil(serie.length / 8);
    serie.forEach((p, i) => { if (i % paso === 0 || i === serie.length - 1) h += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" fill="${cTx}" font-size="11">${fechaCorta(p.fecha)}</text>`; });
    const linea = (campo) => serie.map((p, i) => (p[campo] ? [x(i), y(p[campo])] : null)).filter(Boolean);
    const lm = linea("media"), lp = linea("precio");
    if (lm.length > 1) h += `<polyline points="${lm.join(" ")}" fill="none" stroke="${cAz}" stroke-width="2" stroke-dasharray="5 5"/>`;
    if (lp.length > 1) h += `<polygon points="${lp[0][0]},${H - m.b} ${lp.join(" ")} ${lp[lp.length - 1][0]},${H - m.b}" fill="url(#gArea)"/><polyline points="${lp.join(" ")}" fill="none" stroke="${cAc}" stroke-width="3" stroke-linejoin="round"/>`;
    lp.forEach(([a, b]) => (h += `<circle cx="${a}" cy="${b}" r="4" fill="${cFondo}" stroke="${cAc}" stroke-width="2.5"/>`));
    const ancho = (W - m.l - m.r) / Math.max(1, serie.length - 1);
    serie.forEach((p, i) => (h += `<rect data-i="${i}" x="${x(i) - ancho / 2}" y="0" width="${ancho}" height="${H}" fill="transparent"/>`));
    svg.innerHTML = h;

    const tip = $("#h-tip");
    svg.onmousemove = (ev) => {
      const r = ev.target.closest("rect[data-i]"); if (!r) { tip.classList.add("oculto"); return; }
      const p = serie[+r.dataset.i];
      tip.innerHTML = `<b>${fechaCorta(p.fecha)}</b><br>Gasolinera: ${fmtPrecio(p.precio)} €/L<br>Media municipio: ${fmtPrecio(p.media)} €/L`;
      tip.classList.remove("oculto");
      const caja = svg.parentElement.getBoundingClientRect();
      tip.style.left = Math.min(ev.clientX - caja.left + 14, caja.width - 190) + "px";
      tip.style.top = ev.clientY - caja.top - 20 + "px";
    };
    svg.onmouseleave = () => tip.classList.add("oculto");

    const pr = serie.map((p) => p.precio).filter(Boolean);
    if (pr.length) {
      const ult = pr[pr.length - 1], pri = pr[0], dif = ult - pri;
      $("#h-hoy").textContent = fmtPrecio(ult) + " €";
      $("#h-min").textContent = fmtPrecio(Math.min(...pr)) + " €";
      $("#h-max").textContent = fmtPrecio(Math.max(...pr)) + " €";
      const v = $("#h-var");
      v.textContent = (dif > 0 ? "+" : dif < 0 ? "-" : "") + fmtPrecio(Math.abs(dif)) + " €";
      v.style.color = dif < 0 ? "var(--verde)" : dif > 0 ? "var(--rojo)" : "";
    }
  }

  /* ======================= ALERTAS ======================= */
  function initAlertas() {
    $("#a-comb").innerHTML = opcionesComb(combPref);
    $("#a-tipo").addEventListener("change", ajustarFormAlerta);
    $("#a-comb").addEventListener("change", sugerirObjetivo);
    $("#a-est").addEventListener("change", sugerirObjetivo);
    $("#a-crear").addEventListener("click", crearAlerta);
    $("#a-comprobar").addEventListener("click", async () => {
      try { const d = await datos(); const hubo = await GR.comprobarAlertas(d); pintarAlertas(); if (!hubo) GR.toast("Alertas comprobadas", "Ninguna alerta nueva ha alcanzado su objetivo hoy.", "ok"); }
      catch { GR.toast("Sin conexión", "No se pudieron descargar los precios.", "error"); }
    });
    $("#lista-alertas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-borrar]"); if (!b) return;
      GR.alertas.quitar(b.dataset.borrar); pintarAlertas();
    });
    const n = $("#n-activar");
    const estadoNotif = () => {
      if (!("Notification" in window)) { $("#n-estado").textContent = "Tu navegador no admite notificaciones; verás los avisos dentro de la web."; n.disabled = true; return; }
      if (Notification.permission === "granted") { $("#n-estado").textContent = "Activadas. Te avisaremos al abrir la web."; n.textContent = "Activadas"; n.disabled = true; }
      else if (Notification.permission === "denied") { $("#n-estado").textContent = "Bloqueadas en los ajustes del navegador."; n.disabled = true; }
    };
    n.addEventListener("click", async () => { try { await Notification.requestPermission(); } catch {} estadoNotif(); });
    estadoNotif();
    refrescarAlertas();
    GR.mejorarSelector($("#a-est"));
    window.addEventListener("cercanascargadas", refrescarAlertas);
    GR.cargarCercanas();
  }
  function refrescarAlertas() {
    $("#a-est").innerHTML = opcionesEstaciones(GR.leer("histSel", null));
    ajustarFormAlerta();
    pintarAlertas();
  }
  function ajustarFormAlerta() {
    const zona = $("#a-tipo").value === "zona";
    $("#a-est-campo").classList.toggle("oculto", zona);
    $("#a-radio-campo").classList.toggle("oculto", !zona);
    const u = GR.leer("ultimoOrigen", null);
    $("#a-ayuda").textContent = zona ? (u ? `Zona: ${(u.nombre || "tu ubicación").split(",").slice(0, 2).join(",")}.` : "Haz primero una búsqueda en el buscador para fijar la zona.") : "";
    sugerirObjetivo();
  }
  async function sugerirObjetivo() {
    try {
      const d = await datos();
      const a = leerFormAlerta(); if (!a) return;
      const r = GR.evaluarAlerta({ ...a, objetivo: 0 }, d);
      if (r) { $("#a-obj").value = (Math.floor((r.precio - 0.02) * 1000) / 1000).toFixed(3); $("#a-ayuda").textContent += ` Ahora mismo el mejor precio es ${fmtPrecio(r.precio)} €/L.`; }
    } catch {}
  }
  function leerFormAlerta() {
    const tipo = $("#a-tipo").value, comb = $("#a-comb").value, objetivo = parseFloat($("#a-obj").value);
    if (tipo === "zona") {
      const u = GR.leer("ultimoOrigen", null); if (!u) return null;
      return { tipo, combustible: comb, objetivo, lat: u.lat, lon: u.lon, radio: Math.min(50, Math.max(1, +$("#a-radio").value || 10)), zona: (u.nombre || "Tu ubicación").split(",").slice(0, 2).join(",") };
    }
    const e = estacionesConocidas().find((x) => x.id === $("#a-est").value); if (!e) return null;
    return { tipo, combustible: comb, objetivo, estacionId: e.id, nombre: `${e.rotulo} - ${e.municipio}` };
  }
  async function crearAlerta() {
    const a = leerFormAlerta();
    if (!a) { GR.toast("Falta información", "Haz una búsqueda en el buscador antes de crear la alerta.", "error"); return; }
    if (!(a.objetivo > 0)) { GR.toast("Precio no válido", "Indica un precio objetivo.", "error"); return; }
    GR.alertas.anadir(a);
    GR.toast("Alerta creada", `Te avisaremos cuando ${GR.combustible(a.combustible).nombre} baje a ${fmtPrecio(a.objetivo)} €/L.`, "ok");
    try { await GR.comprobarAlertas(await datos()); } catch {}
    pintarAlertas();
  }
  async function pintarAlertas() {
    const l = GR.alertas.todas(), cont = $("#lista-alertas");
    if (!l.length) { cont.innerHTML = `<div class="vacio"><div class="icono-grande">${icono("campana")}</div><h3>Sin alertas</h3><p>Crea tu primera alerta y deja que los precios vengan a ti.</p></div>`; return; }
    let d = null; try { d = await datos(); } catch {}
    cont.innerHTML = l.map((a) => {
      const r = d ? GR.evaluarAlerta(a, d) : null;
      const estado = !r ? '<span class="pill">Sin datos</span>' : r.cumple ? `<span class="pill ok">Objetivo alcanzado: ${fmtPrecio(r.precio)} €</span>` : `<span class="pill warn">Ahora ${fmtPrecio(r.precio)} € · faltan ${fmtPrecio(r.precio - a.objetivo)} €</span>`;
      const donde = a.tipo === "zona" ? `En ${a.radio} km de ${esc(a.zona)}` : esc(a.nombre);
      const ir = r && r.cumple ? `<a class="btn btn-maps btn-peq" href="${GR.urlMaps(r.estacion)}" target="_blank" rel="noopener">${icono("ruta")}Ir</a>` : "";
      return `<div class="item">
        <span class="inicial" style="width:42px;height:42px;background:${r && r.cumple ? "var(--grad)" : "var(--grad-fria)"};color:${r && r.cumple ? "var(--sobre-acento)" : "#fff"}">${icono("bajada")}</span>
        <div><h4>${GR.combustible(a.combustible).nombre} a ${fmtPrecio(a.objetivo)} €/L o menos</h4><p>${donde}${r && r.cumple ? " · " + esc(r.estacion.rotulo) + ", " + esc(r.estacion.municipio) : ""}</p><div class="precios">${estado}</div></div>
        <div class="der">${ir}<button class="btn btn-fantasma btn-peq" data-borrar="${a.id}" aria-label="Eliminar alerta">${icono("papelera")}</button></div></div>`;
    }).join("");
  }

  /* ======================= OPINIONES ======================= */
  let notaElegida = 0;
  function initOpiniones() {
    const est = $("#o-estrellas");
    const pintarEstrellas = () => {
      est.innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" data-n="${i}" class="${i <= notaElegida ? "on" : ""}" aria-label="${i} estrellas">${icono("estrella", "")}</button>`).join("");
    };
    est.addEventListener("click", (ev) => { const b = ev.target.closest("[data-n]"); if (b) { notaElegida = +b.dataset.n; pintarEstrellas(); } });
    est.addEventListener("mouseover", (ev) => { const b = ev.target.closest("[data-n]"); if (b) est.querySelectorAll("button").forEach((x) => x.classList.toggle("on", +x.dataset.n <= +b.dataset.n)); });
    est.addEventListener("mouseleave", pintarEstrellas);
    pintarEstrellas();
    $("#o-nombre").value = GR.leer("nombre", "");
    $("#o-est").addEventListener("change", pintarOpiniones);
    $("#form-opinion").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const id = $("#o-est").value;
      if (!id) { GR.toast("Elige una gasolinera", "Primero busca gasolineras en el buscador.", "error"); return; }
      if (!notaElegida) { GR.toast("Falta la valoración", "Marca de 1 a 5 estrellas.", "error"); return; }
      const nombre = $("#o-nombre").value.trim(), texto = $("#o-texto").value.trim();
      if (!nombre || !texto) return;
      if (texto.length < 10) { GR.toast("Comentario muy corto", "Escribe al menos 10 caracteres.", "error"); return; }
      if (GR.nube?.configurada && !GR.nube.usuario()) {
        GR.toast("Entra para publicar", "Las opiniones públicas necesitan una cuenta. Entra o créala en Mi cuenta; tu texto se queda aquí escrito.", "alerta", 8000);
        return;
      }
      GR.opiniones.anadir(id, { nombre, nota: notaElegida, texto });
      GR.guardar("nombre", nombre);
      $("#o-texto").value = ""; notaElegida = 0; pintarEstrellas();
      GR.toast("Gracias por tu opinión", "Se ha publicado correctamente.", "ok");
      pintarOpiniones();
    });
    window.addEventListener("opinionpublicada", pintarOpiniones);
    GR.mejorarSelector($("#o-est"));
    let elegidaOp = false;
    $("#o-est").addEventListener("change", () => { elegidaOp = true; });
    window.addEventListener("cercanascargadas", () => {
      // si la persona aún no ha elegido, se muestra la más cercana
      if (!elegidaOp && !new URLSearchParams(location.search).get("estacion")) $("#o-est").value = "";
      refrescarOpiniones(); pintarFicha();
    });
    GR.cargarCercanas();
    const avisoOp = document.querySelector("#sec-opiniones .aviso span");
    if (avisoOp && GR.nube?.configurada) avisoOp.textContent = "Las opiniones son públicas y se publican con tu cuenta, con el nombre que elijas en Mi cuenta. Puedes editar o borrar la tuya cuando quieras.";
    refrescarOpiniones();
  }
  function refrescarOpiniones() {
    const param = new URLSearchParams(location.search).get("estacion");
    $("#o-est").innerHTML = opcionesEstaciones(param || $("#o-est").value);
    pintarOpiniones();
  }
  let turnoOp = 0;
  async function pintarOpiniones() {
    const id = $("#o-est").value, turno = ++turnoOp;
    let l = id ? GR.opiniones.de(id) : [];
    let media = GR.opiniones.media(id);
    if (id && GR.nube?.configurada) {
      try {
        const r = await GR.nube.opinionesDe(id);
        if (turno !== turnoOp) return;
        if (r) { l = r.lista; media = r.media; }
      } catch (err) { console.warn(err); }
    }
    $("#o-resumen").innerHTML = id ? `<div class="resumen-op"><div class="nota-media">${media ? media.toFixed(1).replace(".", ",") : "--"}</div>
      <div>${GR.estrellasHTML(media || 0, false)}<div style="color:var(--texto-3);font-size:.85rem">${l.length} ${l.length === 1 ? "opinión" : "opiniones"}</div></div></div>` : "";
    $("#lista-opiniones").innerHTML = !id ? "" : l.length
      ? l.map((o) => `<div class="opinion"><div class="cab"><span class="autor"><span class="inicial" style="width:30px;height:30px;font-size:.75rem">${esc(GR.iniciales(o.nombre))}</span>${esc(o.nombre)}${o.mia ? ' <span class="pill ok">tuya</span>' : ""}</span>${GR.estrellasHTML(o.nota)}</div>
          <p>${esc(o.texto)}</p><div class="fecha">${new Date(o.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</div></div>`).join("")
      : `<div class="vacio" style="padding:30px"><h3 style="margin-top:0">Todavía no hay opiniones</h3><p>Sé el primero en valorar esta gasolinera.</p></div>`;
  }

  /* ======================= INICIO ======================= */
  function initInicio() {
    const u = GR.leer("ultimaBusqueda", null);
    const caja = $("#tu-zona");
    if (u && caja) {
      const c = GR.combustible(u.combustible);
      caja.innerHTML = `<div class="zona-cab"><div><span class="lbl">Tu última búsqueda</span><h3>${esc((u.nombre || "Tu zona").split(",").slice(0, 2).join(","))} · ${c.nombre}</h3></div><a class="btn btn-sec btn-peq" href="buscador.html">${icono("buscar")}Ver resultados</a></div>
        <div class="zona-datos"><div><span>Más barata</span><b class="verde">${fmtPrecio(u.barata)} €/L</b><small>${esc(u.estacionBarata || "")}</small></div>
        <div><span>Media de la zona</span><b>${fmtPrecio(u.media)} €/L</b><small>${u.radio} km a la redonda</small></div>
        <div><span>Ahorro en 50 L</span><b class="acento">${fmtEuros((u.media - u.barata) * 50)}</b><small>frente a la media</small></div></div>`;
      caja.classList.remove("oculto");
    }
    const n = { favoritos: GR.favoritos.todos().length, alertas: GR.alertas.todas().length, comparar: GR.comparar.todas().length };
    document.querySelectorAll("[data-contador]").forEach((el) => { const v = n[el.dataset.contador]; if (v) { el.textContent = v; el.classList.remove("oculto"); } });
    const q = $("#inicio-form");
    if (q) {
      q.addEventListener("submit", (ev) => { ev.preventDefault(); const t = $("#inicio-dir").value.trim(); location.href = t ? "buscador.html?q=" + encodeURIComponent(t) : "buscador.html?ubicacion=1"; });
      $("#inicio-ubicacion").addEventListener("click", () => { GR.guardar("prefUbicacion", "si"); location.href = "buscador.html?ubicacion=1"; });
    }
    // Pregunta por la ubicación la primera vez
    const m = $("#modal-ubicacion");
    if (m && GR.leer("prefUbicacion", null) === null) {
      m.classList.remove("oculto");
      $("#modal-si").onclick = () => { GR.guardar("prefUbicacion", "si"); location.href = "buscador.html?ubicacion=1"; };
      $("#modal-no").onclick = () => { m.classList.add("oculto"); GR.guardar("prefUbicacion", "no"); $("#inicio-dir").focus(); };
    }
  }

  /* ======================= COMPARADOR =======================
     Arriba: las gasolineras más cercanas a la ubicación de la persona (o a la dirección
     que escriba), con precio y distancia, para marcar hasta 4.
     Abajo: la tabla con todas ellas lado a lado.                                   */
  const cerca = { origen: null, lista: [], orden: "distancia", comb: combPref, mostrar: 12, rutas: new Map(), turno: 0 };
  const rutaDe = (e) => (cerca.origen ? cerca.rutas.get(e.id) : null);
  const kmDe = (e) => { const r = rutaDe(e); return r ? r.km : e.kmRecta; };

  function initComparador() {
    $("#cmp-litros").value = GR.perfil.leer().deposito;
    $("#cerca-comb").innerHTML = opcionesComb(cerca.comb);
    $("#cerca-ubic").innerHTML = `${icono("mira")}Usar mi ubicación`;

    $("#cerca-comb").addEventListener("change", (ev) => { cerca.comb = ev.target.value; GR.guardar("combustible", cerca.comb); calcularCerca(); pintarComparador(); });
    $("#cerca-orden").addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-orden]"); if (!b) return;
      cerca.orden = b.dataset.orden;
      $("#cerca-orden").querySelectorAll("button").forEach((x) => x.classList.toggle("activo", x === b));
      pintarCerca();
    });
    $("#cerca-ubic").addEventListener("click", () => { GR.guardar("prefUbicacion", "si"); ubicarme(true); });
    $("#cerca-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const t = $("#cerca-texto").value.trim(); if (!t) { $("#cerca-texto").focus(); return; }
      $("#cerca-origen").innerHTML = '<span class="spinner peq"></span> Buscando la dirección...';
      try {
        const r = await GR.geocodificar(t);
        if (!r.length) { GR.toast("No encontrada", "Prueba con otra dirección, una ciudad o un código postal.", "alerta"); pintarOrigenCerca(); return; }
        fijarOrigen({ lat: r[0].lat, lon: r[0].lon, nombre: r[0].nombre });
      } catch { GR.toast("Sin conexión", "No se pudo buscar la dirección. Inténtalo de nuevo.", "alerta"); pintarOrigenCerca(); }
    });
    $("#cerca-lista").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-sel]"); if (!b) return;
      const e = cerca.lista.find((x) => x.id === b.dataset.sel); if (!e) return;
      const r = GR.comparar.alternar(e);
      if (r === null) { GR.toast("Ya tienes 4", "Quita una de las seleccionadas para elegir otra.", "alerta"); b.classList.add("sacude"); setTimeout(() => b.classList.remove("sacude"), 400); return; }
      pintarCerca(); pintarComparador();
      if (r && GR.comparar.todas().length === GR.comparar.max) {
        GR.toast("Comparación lista", "Tienes 4 gasolineras seleccionadas. Mira la tabla de abajo.", "ok");
        setTimeout(() => $("#caja-cmp").scrollIntoView({ behavior: "smooth", block: "start" }), 250);
      }
    });
    $("#cerca-mas").addEventListener("click", () => { cerca.mostrar += 12; pintarCerca(); });

    $("#cmp-anadir").addEventListener("click", () => {
      const id = $("#cmp-est").value; if (!id) return;
      const e = estacionesConocidas().find((x) => x.id === id);
      if (!e || GR.comparar.tiene(id)) return;
      if (GR.comparar.alternar(e) === null) { GR.toast("Ya tienes 4", "Quita una para añadir otra.", "alerta"); return; }
      pintarCerca(); pintarComparador();
    });
    $("#cmp-litros").addEventListener("input", pintarComparador);
    $("#cmp-vaciar").addEventListener("click", () => { GR.comparar.todas().forEach((e) => GR.comparar.quitar(e.id)); pintarCerca(); pintarComparador(); });
    $("#cmp-tabla").addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-quitar-cmp]"); if (q) { GR.comparar.quitar(q.dataset.quitarCmp); pintarCerca(); pintarComparador(); }
    });
    window.addEventListener("storage", (ev) => { if (ev.key === "gr_comparar") { pintarCerca(); pintarComparador(); } });

    // Punto de partida: primero el último conocido (al momento) y después la ubicación real
    datos().catch(() => {}); // los precios se descargan mientras se busca la ubicación
    const ultimo = GR.leer("ultimoOrigen", null);
    const pref = GR.leer("prefUbicacion", null);
    if (ultimo) fijarOrigen(ultimo, false);
    if (pref !== "no") ubicarme(false, !!ultimo);
    else if (!ultimo) sinOrigen();
    pintarComparador();
  }

  function sinOrigen(msg) {
    $("#cerca-origen").textContent = msg || "Comparte tu ubicación o escribe una dirección para ver las gasolineras cercanas.";
    $("#cerca-lista").innerHTML = `<div class="vacio"><div class="icono-grande">${icono("mira")}</div><h3>¿Dónde estás?</h3><p>Pulsa "Usar mi ubicación" o escribe una dirección y te enseñamos las gasolineras más cercanas con su precio.</p></div>`;
  }

  async function ubicarme(pulsado, hayAlternativa = false) {
    if (pulsado || !cerca.origen) $("#cerca-origen").innerHTML = '<span class="spinner peq"></span> Obteniendo tu ubicación...';
    try {
      const p = await GR.pedirUbicacion({ forzar: pulsado });
      fijarOrigen({ lat: p.lat, lon: p.lon, nombre: "Tu ubicación", porIP: !!p.porIP, precision: p.precision });
      if (p.porIP && pulsado) GR.toast("Ubicación aproximada", "Te situamos por tu conexión a internet. Escribe tu dirección para afinar.", "alerta", 8000);
    } catch (err) {
      if (pulsado) GR.toast("No se pudo obtener tu ubicación", err.message || "Escribe tu dirección.", "alerta", 9000);
      if (cerca.origen) pintarOrigenCerca();
      else if (!hayAlternativa) sinOrigen("No hemos podido saber dónde estás. Escribe una dirección para ver las gasolineras cercanas.");
    }
  }

  function fijarOrigen(o, guardarlo = true) {
    cerca.origen = o; cerca.rutas = new Map(); cerca.mostrar = 12;
    if (guardarlo) GR.guardar("ultimoOrigen", o);
    pintarOrigenCerca();
    if (!o.direccionReal && o.nombre === "Tu ubicación") {
      GR.direccionDe(o.lat, o.lon).then((d) => { if (d && cerca.origen === o) { o.direccionReal = d; pintarOrigenCerca(); GR.guardar("ultimoOrigen", o); } });
    }
    calcularCerca();
  }

  function pintarOrigenCerca() {
    const o = cerca.origen; if (!o) return;
    let t = o.nombre === "Tu ubicación" ? `Desde tu ubicación${o.direccionReal ? ": " + esc(o.direccionReal) : ""}` : `Desde ${esc((o.direccionReal || o.nombre || "").split(",").slice(0, 2).join(","))}`;
    if (o.porIP) t += ' <em class="impreciso">(aproximada)</em>';
    $("#cerca-origen").innerHTML = t;
  }

  async function calcularCerca() {
    const o = cerca.origen; if (!o) return;
    const turno = ++cerca.turno;
    cerca.cargado = false;
    $("#cerca-lista").innerHTML = '<div class="cerca-esq"></div>'.repeat(6);
    $("#cerca-ayuda").textContent = "Descargando precios oficiales...";
    let d;
    try { d = await datos(); }
    catch {
      if (turno !== cerca.turno) return;
      $("#cerca-lista").innerHTML = `<div class="vacio"><div class="icono-grande">${icono("info")}</div><h3>No se pudieron descargar los precios</h3><p>El servicio del Ministerio no responde ahora mismo. Inténtalo en unos minutos.</p><p style="margin-top:14px"><button class="btn btn-sec btn-peq" id="cerca-reintentar" type="button">Reintentar</button></p></div>`;
      $("#cerca-reintentar").onclick = calcularCerca; $("#cerca-ayuda").textContent = ""; return;
    }
    if (turno !== cerca.turno) return;
    const radio = Math.max(5, GR.leer("radio", 10));
    const todas = d.estaciones
      .filter((e) => e.precios[cerca.comb])
      .map((e) => ({ ...e, kmRecta: GR.distanciaKm(o.lat, o.lon, e.lat, e.lon) }))
      .sort((a, b) => a.kmRecta - b.kmRecta);
    let lista = todas.filter((e) => e.kmRecta <= radio);
    if (lista.length < 8) lista = todas.slice(0, 8); // zonas con pocas gasolineras: las 8 más próximas
    cerca.lista = lista.slice(0, 48);
    cerca.cargado = true;
    pintarCerca();
    // distancia real por carretera (la misma que dará "Cómo llegar")
    try {
      const r = await GR.distanciasCarretera(o, cerca.lista);
      if (turno !== cerca.turno) return;
      cerca.lista.forEach((e, i) => r[i] && cerca.rutas.set(e.id, r[i]));
      pintarCerca(); pintarComparador();
    } catch (err) { console.warn("Distancias por carretera:", err); }
  }

  function pintarCerca() {
    const cont = $("#cerca-lista");
    const sel = new Set(GR.comparar.todas().map((e) => e.id));
    const n = sel.size, lleno = n >= GR.comparar.max;
    $("#cmp-cuenta").textContent = `${n} de ${GR.comparar.max}`;
    $("#cerca-puntos").querySelectorAll("i").forEach((p, i) => p.classList.toggle("on", i < n));
    if (!cerca.origen) return;
    if (!cerca.lista.length) {
      if (cerca.cargado) cont.innerHTML = `<div class="vacio"><h3 style="margin-top:0">Ninguna gasolinera vende ${esc(GR.combustible(cerca.comb).nombre)} cerca</h3><p>Prueba con otro combustible.</p></div>`;
      return;
    }
    const comb = cerca.comb;
    const l = [...cerca.lista].sort(cerca.orden === "precio" ? (a, b) => a.precios[comb] - b.precios[comb] || kmDe(a) - kmDe(b) : (a, b) => kmDe(a) - kmDe(b));
    const precios = cerca.lista.map((e) => e.precios[comb]);
    const min = Math.min(...precios), max = Math.max(...precios);
    const masCerca = cerca.lista.reduce((a, b) => (kmDe(b) < kmDe(a) ? b : a));
    const visibles = l.slice(0, cerca.mostrar);
    cont.innerHTML = visibles.map((e, i) => {
      const p = e.precios[comb], r = rutaDe(e), esSel = sel.has(e.id);
      const nivel = max - min < 0.005 ? "medio" : p - min <= (max - min) / 3 ? "bajo" : p - min >= (2 * (max - min)) / 3 ? "alto" : "medio";
      const insignias = [p === min ? '<span class="cerca-ins barata">Más barata</span>' : "", e.id === masCerca.id ? '<span class="cerca-ins">Más cerca</span>' : ""].join("");
      return `<button type="button" class="cerca-tarjeta ${esSel ? "sel" : ""} ${lleno && !esSel ? "bloq" : ""}" data-sel="${esc(e.id)}" aria-pressed="${esSel}" style="animation-delay:${Math.min(i, 11) * 25}ms">
        <span class="cerca-check">${icono("check")}</span>
        ${GR.logoHTML(e.rotulo)}
        <span class="cerca-info">
          <b>${esc(e.rotulo)}</b>
          <small>${esc(e.direccion)}, ${esc(e.municipio)}</small>
          <span class="cerca-meta"><span class="cerca-dist">${icono("ruta")}${fmtKm(kmDe(e))}${r ? ` · ${Math.max(1, Math.round(r.min))} min` : " en línea recta"}</span>${insignias}</span>
        </span>
        <span class="cerca-precio ${nivel}"><strong>${fmtPrecio(p)}</strong><small>€/L</small></span>
      </button>`;
    }).join("");
    $("#cerca-mas").classList.toggle("oculto", l.length <= cerca.mostrar);
    const fuente = cerca.rutas.size ? `Distancias por carretera (${GR.fuenteDistancias()}).` : "Calculando distancias por carretera...";
    $("#cerca-ayuda").textContent = `${cerca.lista.length} gasolineras con ${GR.combustible(comb).nombre} cerca. ${fuente} ${lleno ? "Ya tienes 4: quita una para elegir otra." : "Toca una tarjeta para añadirla a la comparación."}`;
  }

  let turnoCmp = 0;
  async function pintarComparador() {
    const turno = ++turnoCmp;
    const sel = GR.comparar.todas(), cont = $("#cmp-tabla");
    const lleno = sel.length >= GR.comparar.max;
    // selector secundario: favoritas y recientes que no estén ya en la lista de cercanas
    const enLista = new Set([...sel.map((e) => e.id), ...cerca.lista.map((e) => e.id)]);
    const hayGuardadas = !lleno && estacionesConocidas().some((e) => !enLista.has(e.id));
    $("#cmp-guardadas").classList.toggle("oculto", !hayGuardadas);
    if (hayGuardadas) $("#cmp-est").innerHTML = opcionesEstaciones(null, enLista);
    $("#cmp-vaciar").classList.toggle("oculto", !sel.length);
    $("#cmp-cuenta").textContent = `${sel.length} de ${GR.comparar.max}`;
    if (!sel.length) {
      cont.innerHTML = `<div class="vacio"><div class="icono-grande">${icono("comparar")}</div><h3>Elige hasta 4 gasolineras</h3><p>Toca las tarjetas de arriba y aquí verás todos sus precios lado a lado y lo que cuesta llenar el depósito en cada una.</p></div>`;
      return;
    }
    pintarTablaCmp(sel, new Map());
    const act = new Map();
    try { const d = await datos(); const ids = new Set(sel.map((e) => e.id)); d.estaciones.forEach((e) => ids.has(e.id) && act.set(e.id, e)); } catch {}
    if (turno === turnoCmp) pintarTablaCmp(GR.comparar.todas(), act);
  }
  function pintarTablaCmp(sel, act) {
    const cont = $("#cmp-tabla");
    const est = sel.map((e) => act.get(e.id) || e).map((e) => ({ ...e, precios: e.precios || {} }));
    const origen = cerca.origen || GR.leer("ultimoOrigen", null);
    const litros = Math.max(1, parseFloat($("#cmp-litros").value) || 50);
    const pref = cerca.comb;
    const filas = GR.COMBUSTIBLES.filter((c) => est.some((e) => e.precios[c.id]));
    const minDe = (c) => Math.min(...est.map((e) => e.precios[c] || Infinity));
    let h = '<div class="tabla-scroll"><table class="tabla-cmp"><thead><tr><th></th>';
    est.forEach((e) => {
      const r = rutaDe(e);
      const dist = r ? `${fmtKm(r.km)} · ${Math.max(1, Math.round(r.min))} min` : origen ? fmtKm(GR.distanciaKm(origen.lat, origen.lon, e.lat, e.lon)) + " en línea recta" : "";
      h += `<th><div class="cmp-cab">${GR.logoHTML(e.rotulo)}<div><b>${esc(e.rotulo)}</b><small>${esc(e.direccion)}, ${esc(e.municipio)}</small>${dist ? `<small>${dist}</small>` : ""}</div><button type="button" class="btn-x" data-quitar-cmp="${esc(e.id)}" aria-label="Quitar">${icono("cerrar")}</button></div></th>`;
    });
    h += "</tr></thead><tbody>";
    filas.forEach((c) => {
      const min = minDe(c.id);
      h += `<tr class="${c.id === pref ? "fila-pref" : ""}"><th>${c.nombre}${c.id === pref ? ' <span class="pill ok">tu combustible</span>' : ""}</th>`;
      est.forEach((e) => { const p = e.precios[c.id]; h += `<td class="${p && p === min && est.length > 1 ? "mejor" : ""}">${p ? fmtPrecio(p) + " €/L" : '<span class="nd">No vende</span>'}</td>`; });
      h += "</tr>";
    });
    const cp = GR.combustible(pref);
    const costes = est.map((e) => (e.precios[pref] ? e.precios[pref] * litros : null));
    const minCoste = Math.min(...costes.filter((x) => x != null));
    h += `<tr class="fila-total"><th>Llenar ${litros} L de ${cp.nombre}</th>${costes.map((v) => `<td class="${v != null && v === minCoste && est.length > 1 ? "mejor" : ""}">${v != null ? fmtEuros(v) + (v > minCoste ? `<small>+${fmtEuros(v - minCoste)}</small>` : "") : "--"}</td>`).join("")}</tr>`;
    h += `<tr><th>Horario</th>${est.map((e) => `<td class="txt">${esc(e.horario || "--")}</td>`).join("")}</tr>`;
    h += `<tr><th></th>${est.map((e) => `<td><a class="btn btn-maps btn-peq" href="${GR.urlMaps(e, origen)}" target="_blank" rel="noopener">${icono("ruta")}Cómo llegar</a></td>`).join("")}</tr>`;
    h += "</tbody></table></div>";
    cont.innerHTML = h;
  }

  /* ======================= ESTADÍSTICAS DE LA ZONA ======================= */
  async function initZona() {
    const cont = $("#zona-stats"); if (!cont) return;
    const o = GR.leer("ultimoOrigen", null);
    if (!o) { cont.innerHTML = `<div class="vacio"><h3 style="margin-top:0">Aún no hay zona</h3><p>Haz una búsqueda en el buscador para ver las estadísticas de tu zona.</p></div>`; return; }
    const radio = GR.leer("radio", 10);
    cont.innerHTML = '<div class="cargando"><div class="spinner"></div>Calculando...</div>';
    let d; try { d = await datos(); } catch { cont.innerHTML = '<div class="vacio"><p>No se pudieron descargar los precios.</p></div>'; return; }
    const cerca = d.estaciones.filter((e) => Math.abs(e.lat - o.lat) < radio / 100 + 0.1 && GR.distanciaKm(o.lat, o.lon, e.lat, e.lon) <= radio);
    $("#zona-titulo").textContent = `${(o.direccionReal || o.nombre || "Tu zona").split(",").slice(0, 2).join(",")} · ${radio} km · ${cerca.length} gasolineras`;
    const filas = GR.COMBUSTIBLES.map((c) => {
      const p = cerca.map((e) => e.precios[c.id]).filter(Boolean).sort((a, b) => a - b);
      if (!p.length) return "";
      const media = p.reduce((s, x) => s + x, 0) / p.length;
      return `<tr><th>${c.nombre}</th><td class="mejor">${fmtPrecio(p[0])}</td><td>${fmtPrecio(media)}</td><td>${fmtPrecio(p[p.length - 1])}</td><td>${fmtEuros((p[p.length - 1] - p[0]) * 50)}</td><td>${p.length}</td></tr>`;
    }).join("");
    // marcas más baratas para el combustible elegido
    const c = GR.leer("combustible", "g95");
    const porMarca = new Map();
    cerca.forEach((e) => { const p = e.precios[c]; if (!p) return; const k = e.rotulo.toUpperCase(); const v = porMarca.get(k) || { rotulo: e.rotulo, s: 0, n: 0 }; v.s += p; v.n++; porMarca.set(k, v); });
    const marcas = [...porMarca.values()].map((v) => ({ ...v, media: v.s / v.n })).sort((a, b) => a.media - b.media).slice(0, 8);
    const lo = marcas.length ? marcas[0].media : 0, hi = marcas.length ? marcas[marcas.length - 1].media : 1;
    const barras = marcas.map((m) => `<div class="barra-marca">${GR.logoHTML(m.rotulo, "mini")}<span class="nombre">${esc(m.rotulo)} <small>${m.n} ${m.n === 1 ? "estación" : "estaciones"}</small></span><div class="pista"><div class="relleno" style="width:${hi > lo ? 25 + ((m.media - lo) / (hi - lo)) * 75 : 60}%"></div></div><b>${fmtPrecio(m.media)}</b></div>`).join("");
    cont.innerHTML = `<div class="tabla-scroll"><table class="tabla-cmp tabla-zona"><thead><tr><th>Combustible</th><th>Más barata</th><th>Media</th><th>Más cara</th><th>Diferencia en 50 L</th><th>Estaciones</th></tr></thead><tbody>${filas}</tbody></table></div>
      <h3 class="sub-titulo">Marcas más baratas en tu zona · ${GR.combustible(c).nombre}</h3><p class="ayuda" style="margin-bottom:12px">Precio medio por marca, en €/L. Solo cuenta las gasolineras de tu radio de búsqueda.</p>${barras || '<p class="ayuda">No hay datos para este combustible.</p>'}`;
  }

  /* ======================= MI CUENTA ======================= */
  function initCuenta() {
    const f = $("#form-cuenta"), p = GR.perfil.leer();
    $("#p-comb").innerHTML = opcionesComb(p.combustible);
    $("#p-nombre").value = p.nombre || GR.leer("nombre", "");
    pintarPerfilEnForm(p);
    $("#p-consumo").value = p.consumo; $("#p-deposito").value = p.deposito; $("#p-radio").value = p.radio;
    const prefU = GR.leer("prefUbicacion", null);
    $("#p-ubicacion").value = prefU === "si" ? "siempre" : prefU === "no" ? "nunca" : "preguntar";
    const temaGuard = GR.leer("tema", null);
    $("#p-tema").value = temaGuard || "sistema";
    f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const t = $("#p-tema").value;
      if (t === "sistema") { try { localStorage.removeItem("gr_tema"); } catch {} GR.ponerTema(matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro", false); }
      else GR.ponerTema(t);
      const marca = $("#p-marca").value.trim(), modelo = $("#p-modelo").value.trim();
      const anio = parseInt($("#p-anio").value) || "";
      GR.perfil.guardar({
        nombre: $("#p-nombre").value.trim(), marca, modelo, anio: anio && anio >= 1950 && anio <= 2100 ? anio : "",
        vehiculo: `${marca} ${modelo}`.trim() || "Mi coche",
        consumo: Math.min(40, Math.max(1, parseFloat($("#p-consumo").value) || 6.5)), deposito: Math.min(500, Math.max(5, parseFloat($("#p-deposito").value) || 50)),
        combustible: $("#p-comb").value, radio: Math.min(50, Math.max(2, parseInt($("#p-radio").value) || 10)), ubicacion: $("#p-ubicacion").value,
      });
      GR.toast("Guardado", "Tus preferencias se usarán en el buscador, la calculadora y el comparador.", "ok");
      pintarResumenDatos();
    });
    $("#p-exportar").addEventListener("click", () => {
      const datosUsuario = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("gr_")) datosUsuario[k.slice(3)] = JSON.parse(localStorage.getItem(k)); } } catch {}
      const blob = new Blob([JSON.stringify({ app: "LitroGo", exportado: new Date().toISOString(), datos: datosUsuario }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "litrogo-mis-datos.json"; document.body.appendChild(a); a.click(); a.remove();
    });
    $("#p-borrar").addEventListener("click", () => {
      if (!confirm("Se borrarán tus favoritos, alertas, opiniones, preferencias y la caché de precios de este dispositivo. No se puede deshacer. ¿Continuar?")) return;
      try { Object.keys(localStorage).filter((k) => k.startsWith("gr_")).forEach((k) => localStorage.removeItem(k)); indexedDB.deleteDatabase("gasoradar"); } catch {}
      GR.toast("Datos borrados", "LitroGo vuelve a estar como recién instalado en este dispositivo.", "ok");
      setTimeout(() => location.reload(), 1200);
    });
    pintarResumenDatos();
    initCuentaNube();
  }
  function pintarPerfilEnForm(p) {
    $("#p-nombre").value = p.nombre || GR.leer("nombre", "");
    const [m1, ...m2] = String(p.vehiculo || "").split(" ");
    $("#p-marca").value = p.marca || (p.vehiculo && p.vehiculo !== "Mi coche" ? m1 : "");
    $("#p-modelo").value = p.modelo || (p.vehiculo && p.vehiculo !== "Mi coche" ? m2.join(" ") : "");
    $("#p-anio").value = p.anio || "";
    $("#p-consumo").value = p.consumo; $("#p-deposito").value = p.deposito; $("#p-radio").value = p.radio;
    $("#p-comb").value = p.combustible;
  }

  /* ---------- Cuenta en la nube (opcional) ---------- */
  const correoValido = (c) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(c);
  const contrasenaValida = (c) => c.length >= 8 && c.length <= 72 && /[a-z]/i.test(c) && /\d/.test(c);
  function initCuentaNube() {
    const nube = GR.nube;
    const msg = (t, tipo = "") => { const el = $("#nube-msg"); el.textContent = t; el.className = "nube-msg " + tipo; };
    const msg2 = (t, tipo = "") => { const el = $("#nube-msg2"); el.textContent = t; el.className = "nube-msg " + tipo; };
    if (!nube || !nube.configurada) { $("#nube-sin-config").classList.remove("oculto"); return; }
    $("#nube-cargando").classList.remove("oculto");

    const ocupado = async (form, fn) => {
      const b = form.querySelector('button[type="submit"]'); const txt = b.textContent;
      b.disabled = true; b.textContent = "Un momento...";
      try { await fn(); } catch (err) { msg(err.message, "error"); msg2(err.message, "error"); } finally { b.disabled = false; b.textContent = txt; }
    };
    document.querySelectorAll("[data-nube-tab]").forEach((a) => a.addEventListener("click", (ev) => {
      ev.preventDefault();
      document.querySelectorAll("[data-nube-tab]").forEach((x) => x.classList.toggle("activo", x === a));
      document.querySelectorAll("[data-nube-panel]").forEach((f) => f.classList.toggle("oculto", f.dataset.nubePanel !== a.dataset.nubeTab));
      msg("");
    }));

    $("#f-entrar").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const correo = $("#e-correo").value.trim(), pass = $("#e-pass").value;
      if (!correoValido(correo)) return msg("Escribe un correo válido.", "error");
      if (!pass) return msg("Escribe tu contraseña.", "error");
      ocupado(ev.target, async () => { await nube.entrar({ correo, contrasena: pass }); $("#e-pass").value = ""; msg("Sesión iniciada. Sincronizando tus datos...", "ok"); });
    });
    $("#f-registro").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const nombre = $("#r-nombre").value.trim(), correo = $("#r-correo").value.trim(), p1 = $("#r-pass").value, p2 = $("#r-pass2").value;
      if (!correoValido(correo)) return msg("Escribe un correo válido.", "error");
      if (!contrasenaValida(p1)) return msg("La contraseña necesita al menos 8 caracteres, con letras y números.", "error");
      if (p1 !== p2) return msg("Las contraseñas no coinciden.", "error");
      if (!$("#r-acepto").checked) return msg("Para crear la cuenta tienes que aceptar la política de privacidad.", "error");
      ocupado(ev.target, async () => {
        const r = await nube.registrar({ correo, contrasena: p1, nombre });
        $("#r-pass").value = $("#r-pass2").value = "";
        msg(r.necesitaConfirmar ? `Te hemos enviado un correo a ${correo}. Pulsa el enlace para confirmar tu cuenta y después entra aquí.` : "Cuenta creada. Sincronizando tus datos...", "ok");
      });
    });
    $("#f-recuperar").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const correo = $("#o-correo").value.trim();
      if (!correoValido(correo)) return msg("Escribe un correo válido.", "error");
      ocupado(ev.target, async () => { await nube.recuperar(correo); msg(`Si existe una cuenta con ${correo}, recibirás un enlace para elegir una contraseña nueva.`, "ok"); });
    });
    $("#f-nueva").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const p1 = $("#n-pass").value, p2 = $("#n-pass2").value;
      if (!contrasenaValida(p1)) return msg2("La contraseña necesita al menos 8 caracteres, con letras y números.", "error");
      if (p1 !== p2) return msg2("Las contraseñas no coinciden.", "error");
      ocupado(ev.target, async () => { await nube.nuevaContrasena(p1); $("#f-nueva").classList.add("oculto"); $("#n-pass").value = $("#n-pass2").value = ""; GR.toast("Contraseña cambiada", "Ya puedes usarla para entrar.", "ok"); });
    });
    $("#nube-cambiar").addEventListener("click", () => { $("#f-nueva").classList.remove("oculto"); $("#n-pass").focus(); });
    $("#nube-sinc").addEventListener("click", async () => { msg2("Sincronizando..."); await nube.sincronizar(); });
    $("#nube-salir").addEventListener("click", async () => { await nube.salir(); GR.toast("Sesión cerrada", "Tus datos siguen guardados en tu cuenta.", "ok"); });
    $("#nube-exportar").addEventListener("click", async () => {
      try {
        const d = await nube.exportar();
        const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "litrogo-mi-cuenta.json"; document.body.appendChild(a); a.click(); a.remove();
      } catch (err) { msg2(err.message, "error"); }
    });
    $("#nube-borrar").addEventListener("click", async () => {
      if (!confirm("Se borrará tu cuenta y TODOS sus datos de la base de datos: perfil, vehículos, favoritos, repostajes, alertas y opiniones. No se puede deshacer. ¿Borrar la cuenta?")) return;
      try { await nube.borrarCuenta(); GR.toast("Cuenta borrada", "Hemos eliminado tu cuenta y todos sus datos.", "ok"); } catch (err) { msg2(err.message, "error"); }
    });

    const pintar = () => {
      const u = nube.usuario();
      $("#nube-cargando").classList.add("oculto");
      $("#nube-invitado").classList.toggle("oculto", !!u);
      $("#nube-conectado").classList.toggle("oculto", !u);
      if (u) {
        $("#nube-correo").textContent = u.email;
        $("#nube-avatar").textContent = (GR.perfil.leer().nombre || u.email || "?").slice(0, 1).toUpperCase();
        const t = GR.leer("nubeUltima", 0);
        $("#nube-estado").textContent = t ? `Sincronizado ${new Date(t).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Sincronizando...";
        $("#nube-plan").textContent = GR.leer("tipoCuenta", "gratuita") === "premium" ? "Premium" : "Cuenta gratuita";
      }
    };
    window.addEventListener("cambiosesion", pintar);
    window.addEventListener("nubesincronizada", (ev) => {
      pintar(); pintarPerfilEnForm(GR.perfil.leer()); pintarResumenDatos();
      const av = ev.detail?.avisos || [];
      msg2(av.length ? av.join(" ") : "Todo sincronizado con tu cuenta.", av.length ? "error" : "ok");
    });
    window.addEventListener("recuperarcontrasena", () => { $("#f-nueva").classList.remove("oculto"); $("#nube-conectado").classList.remove("oculto"); $("#f-nueva").scrollIntoView({ block: "center" }); });
    nube.iniciar().then((c) => { if (!c) { $("#nube-cargando").classList.add("oculto"); $("#nube-invitado").classList.remove("oculto"); msg("No se pudo conectar con el servidor de cuentas. Revisa tu conexión.", "error"); } else pintar(); });
  }

  function pintarResumenDatos() {
    const n = (o) => Object.values(o).reduce((s, l) => s + l.length, 0);
    $("#p-resumen").innerHTML = [
      ["Favoritos", GR.favoritos.todos().length], ["Alertas", GR.alertas.todas().length], ["Opiniones", n(GR.opiniones.todas())], ["En el comparador", GR.comparar.todas().length],
    ].map(([t, v]) => `<div><span>${t}</span><b>${v}</b></div>`).join("");
  }

  /* ======================= SERVICIOS DE LA GASOLINERA ======================= */
  async function pintarFicha() {
    const cont = $("#o-ficha"); if (!cont) return;
    const id = $("#o-est").value;
    if (!id) { cont.innerHTML = ""; return; }
    let e = estacionesConocidas().find((x) => x.id === id);
    try { const d = await datos(); e = d.estaciones.find((x) => x.id === id) || e; } catch {}
    if (!e) return;
    const h24 = /24H/i.test(e.horario || "");
    const venta = e.tipoVenta === "P" ? "Venta al público" : e.tipoVenta === "R" ? "Venta restringida (socios o clientes)" : "";
    const margen = e.margen === "D" ? "Margen derecho de la vía" : e.margen === "I" ? "Margen izquierdo de la vía" : "";
    const servicios = [h24 && "Abierta 24 horas", venta, margen].filter(Boolean);
    const precios = GR.COMBUSTIBLES.filter((c) => e.precios[c.id]).map((c) => `<span class="pill">${c.nombre} <b>${fmtPrecio(e.precios[c.id])}</b></span>`).join("");
    cont.innerHTML = `<div class="ficha">
      <div class="ficha-cab">${GR.logoHTML(e.rotulo, "grande")}<div><h3>${esc(e.rotulo)}</h3><p>${esc(e.direccion)}, ${esc(e.municipio)}</p></div></div>
      <div class="ficha-fila">${icono("reloj")}<span><b>Horario</b>${esc(e.horario || "No publicado")}</span></div>
      <div class="ficha-fila">${icono("check")}<span><b>Servicios</b>${servicios.length ? servicios.map(esc).join(" · ") : "Sin datos"}</span></div>
      <div class="precios">${precios}</div>
      <p class="ayuda">El Ministerio no publica otros servicios, como lavado, tienda o aire. Se añadirán cuando los usuarios puedan aportarlos.</p>
      <div class="ficha-acc"><a class="btn btn-maps btn-peq" href="${GR.urlMaps(e, GR.leer("ultimoOrigen", null))}" target="_blank" rel="noopener">${icono("ruta")}Cómo llegar</a>
      <button class="btn btn-fantasma btn-peq" type="button" id="ficha-fav">${icono("estrella")}${GR.favoritos.es(e.id) ? "Guardada" : "Favorita"}</button></div>
    </div>`;
    $("#ficha-fav").onclick = () => { const on = GR.favoritos.alternar(e); $("#ficha-fav").innerHTML = icono("estrella") + (on ? "Guardada" : "Favorita"); GR.toast(on ? "Añadida a favoritos" : "Quitada de favoritos", e.rotulo, on ? "ok" : ""); };
  }

  /* ---------- Arranque según la página ---------- */
  const INIT = {
    inicio: initInicio, comparador: initComparador, ahorro: initCalculadora, cuenta: initCuenta,
    estadisticas: () => { initHistorial(); initZona(); },
    favoritos: initFavoritos, alertas: initAlertas,
    opiniones: () => { initOpiniones(); $("#o-est").addEventListener("change", pintarFicha); pintarFicha(); },
  };
  const pagina = document.body.dataset.pagina;

  // Si llega una gasolinera por la URL que no conocemos, la buscamos en los datos oficiales
  const param = new URLSearchParams(location.search).get("estacion");
  if (param && !estacionesConocidas().some((e) => e.id === param)) {
    datos().then((d) => {
      const e = d.estaciones.find((x) => x.id === param);
      if (e) { GR.extraConocidas.push(e); if (pagina === "opiniones") { refrescarOpiniones(); pintarFicha(); } }
    }).catch(() => {});
  }
  if (INIT[pagina]) INIT[pagina]();
  datos().catch(() => {});
})();
