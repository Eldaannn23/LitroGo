/* ==========================================================
   LitroGo - cabecera, menú y pie compartidos por todas las páginas.
   Cada página indica cuál es en <body data-pagina="...">.
   ========================================================== */
(() => {
  const { icono } = GR;

  /* Los 9 apartados, en el orden de la navegación */
  const SECCIONES = [
    { n: 1, id: "inicio", t: "Inicio", href: "index.html", ic: "casa", d: "Resumen de tu zona y accesos rápidos" },
    { n: 2, id: "buscador", t: "Buscador", href: "buscador.html", ic: "buscar", d: "Gasolineras cercanas, en lista y en el mapa" },
    { n: 3, id: "comparador", t: "Comparador", href: "comparador.html", ic: "comparar", d: "Hasta 4 gasolineras lado a lado" },
    { n: 4, id: "ahorro", t: "Calculadora de ahorro", corto: "Calculadora", href: "ahorro.html", ic: "calc", grupo: "Ahorro", d: "Cuánto ahorras al mes y al año" },
    { n: 5, id: "estadisticas", t: "Historial y estadísticas", corto: "Historial", href: "estadisticas.html", ic: "grafica", grupo: "Ahorro", d: "Evolución de precios y tu zona" },
    { n: 6, id: "favoritos", t: "Favoritos", href: "favoritos.html", ic: "estrella", grupo: "Mi LitroGo", d: "Tus gasolineras guardadas" },
    { n: 7, id: "alertas", t: "Alertas de precios", corto: "Alertas", href: "alertas.html", ic: "campana", grupo: "Mi LitroGo", d: "Avisos cuando baja el precio" },
    { n: 8, id: "cuenta", t: "Mi cuenta", href: "cuenta.html", ic: "usuario", grupo: "Mi LitroGo", d: "Vehículo, preferencias y tus datos" },
    { n: 9, id: "opiniones", t: "Servicios y opiniones", corto: "Opiniones", href: "opiniones.html", ic: "chat", d: "Horarios, servicios y valoraciones" },
  ];
  const pagina = document.body.dataset.pagina || "";
  const actual = SECCIONES.find((s) => s.id === pagina);

  /* ---------- Cabecera ---------- */
  function enlace(s, clase = "") {
    return `<a href="${s.href}" class="${clase} ${s.id === pagina ? "activo" : ""}" ${s.id === pagina ? 'aria-current="page"' : ""}>${icono(s.ic)}<span>${s.corto || s.t}</span></a>`;
  }
  function grupo(nombre, ic) {
    const items = SECCIONES.filter((s) => s.grupo === nombre);
    const activo = items.some((s) => s.id === pagina);
    return `<div class="grupo-nav ${activo ? "activo" : ""}">
      <button type="button" class="${activo ? "activo" : ""}" aria-haspopup="true">${icono(ic)}<span>${nombre}</span><svg class="ico flecha-abajo" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="desplegable">${items.map((s) => `<a href="${s.href}" class="${s.id === pagina ? "activo" : ""}"><span class="num">${s.n}</span>${icono(s.ic)}<span><b>${s.t}</b><small>${s.d}</small></span></a>`).join("")}</div>
    </div>`;
  }
  const sinGrupo = (id) => SECCIONES.find((s) => s.id === id);
  const cabecera = document.getElementById("cabecera");
  if (cabecera) {
    cabecera.className = "cabecera";
    cabecera.innerHTML = `<div class="contenedor">
      <a class="logo" href="index.html" aria-label="LitroGo, inicio">
        <img class="logo-completo logo-claro" src="img/litrogo-logo.svg" alt="LitroGo" width="122" height="32" />
        <img class="logo-completo logo-oscuro" src="img/litrogo-logo-oscuro.svg" alt="LitroGo" width="122" height="32" />
        <img class="logo-icono" src="img/litrogo-icono.svg" alt="LitroGo" width="36" height="36" />
      </a>
      <nav class="nav" aria-label="Menú principal">
        ${["inicio", "buscador", "comparador"].map((id) => enlace(sinGrupo(id))).join("")}
        ${grupo("Ahorro", "calc")}
        ${grupo("Mi LitroGo", "usuario")}
        ${enlace(sinGrupo("opiniones"))}
      </nav>
      <div class="cabecera-acciones">
        <a class="btn-cuenta oculto" id="btn-cuenta" href="cuenta.html#cuenta-nube" title="Mi cuenta">${icono("usuario")}<span>Entrar</span></a>
        <button class="btn-tema" id="btn-tema" type="button" aria-label="Cambiar entre modo claro y oscuro" title="Modo claro / oscuro">
          <svg class="ico ico-luna" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          <svg class="ico ico-sol" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
        <button class="btn-menu" id="btn-menu" type="button" aria-label="Abrir el menú" aria-expanded="false">${icono("menu")}<span>Menú</span></button>
      </div>
    </div>`;
  }

  /* ---------- Menú completo (tablet y móvil): los 10 apartados en orden ---------- */
  const panel = document.createElement("div");
  panel.className = "menu-panel oculto";
  panel.id = "menu-panel";
  panel.innerHTML = `<div class="menu-hoja" role="dialog" aria-modal="true" aria-label="Menú">
    <div class="menu-cab"><b>Todo LitroGo</b><button type="button" class="btn-tema" id="menu-cerrar" aria-label="Cerrar el menú">${icono("cerrar")}</button></div>
    <ol class="menu-lista">${SECCIONES.map((s) => `<li><a href="${s.href}" class="${s.id === pagina ? "activo" : ""}"><span class="num">${s.n}</span>${icono(s.ic)}<span><b>${s.t}</b><small>${s.d}</small></span></a></li>`).join("")}</ol>
  </div>`;
  document.body.appendChild(panel);
  const abrirMenu = (si) => {
    panel.classList.toggle("oculto", !si);
    document.body.classList.toggle("menu-abierto", si);
    const b = document.getElementById("btn-menu"); if (b) b.setAttribute("aria-expanded", si);
  };
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("#btn-menu, [data-abrir-menu]")) { ev.preventDefault(); abrirMenu(true); return; }
    if (ev.target.closest("#menu-cerrar") || ev.target === panel) abrirMenu(false);
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") abrirMenu(false); });

  /* ---------- Barra inferior (móvil) ---------- */
  const barra = document.createElement("nav");
  barra.className = "nav-movil";
  barra.setAttribute("aria-label", "Accesos rápidos");
  const enBarra = ["inicio", "buscador", "comparador", "ahorro"];
  barra.innerHTML = enBarra.map((id) => { const s = sinGrupo(id); return `<a href="${s.href}" class="${s.id === pagina ? "activo" : ""}">${icono(s.ic)}<span>${s.corto || s.t}</span></a>`; }).join("")
    + `<a href="#" data-abrir-menu class="${actual && !enBarra.includes(actual.id) ? "activo" : ""}">${icono("menu")}<span>Más</span></a>`;
  document.body.appendChild(barra);

  /* ---------- Pie con el mapa de la web ---------- */
  const pie = document.getElementById("pie");
  if (pie) {
    pie.className = "pie";
    const col = (titulo, ids) => `<div><h4>${titulo}</h4>${ids.map((id) => { const s = sinGrupo(id); return `<a href="${s.href}">${s.t}</a>`; }).join("")}</div>`;
    pie.innerHTML = `<div class="contenedor pie-rejilla">
      <div class="pie-marca"><img class="logo-claro-pie" src="img/litrogo-logo.svg" alt="LitroGo" height="28" /><img class="logo-oscuro-pie" src="img/litrogo-logo-oscuro.svg" alt="LitroGo" height="28" />
        <p>Compara precios oficiales de carburantes y reposta donde de verdad ahorras.</p></div>
      ${col("Encontrar", ["inicio", "buscador", "comparador"])}
      ${col("Ahorrar", ["ahorro", "estadisticas"])}
      ${col("Mi LitroGo", ["favoritos", "alertas", "cuenta", "opiniones"])}
    </div>
    <div class="contenedor pie-legal">
      <span>Origen de los datos: Ministerio para la Transición Ecológica y el Reto Demográfico (<a href="https://geoportalgasolineras.es/geoportal-instalaciones/Inicio" target="_blank" rel="noopener">Geoportal de Gasolineras</a>). LitroGo no está vinculado ni patrocinado por el Ministerio. Mapas: OpenFreeMap, OpenMapTiles y OpenStreetMap; satélite: Esri.</span>
      <span>Los precios pueden cambiar durante el día; comprueba el surtidor antes de repostar. <a href="privacidad.html">Privacidad</a></span>
    </div>`;
  }

  /* ---------- Etiqueta con la fecha de los datos, en cualquier página ---------- */
  window.addEventListener("datoscargados", (ev) => {
    const el = document.getElementById("fecha-datos");
    if (el && ev.detail?.fecha) el.textContent = "Precios oficiales actualizados: " + ev.detail.fecha;
  });

  /* ---------- Estado de la sesión en la cabecera ---------- */
  function pintarSesion() {
    const b = document.getElementById("btn-cuenta");
    if (!b || !GR.nube?.configurada) return;
    const u = GR.nube.usuario();
    b.classList.remove("oculto");
    b.classList.toggle("conectado", !!u);
    const nombre = GR.perfil.leer().nombre || (u?.email || "").split("@")[0];
    b.innerHTML = u ? `<span class="avatar">${GR.esc((nombre || "?").slice(0, 1).toUpperCase())}</span><span>${GR.esc(nombre.slice(0, 14))}</span>` : `${icono("usuario")}<span>Entrar</span>`;
    b.title = u ? `Sesión iniciada: ${u.email}` : "Entrar o crear una cuenta";
  }
  window.addEventListener("cambiosesion", pintarSesion);
  window.addEventListener("nubesincronizada", pintarSesion);
  pintarSesion();

  GR.SECCIONES = SECCIONES;
})();
