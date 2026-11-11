/* ==========================================================
   LitroGo - cuentas de usuario y sincronización con Supabase
   ----------------------------------------------------------
   - La cuenta es opcional: sin ella todo funciona como siempre,
     con los datos guardados en este navegador.
   - Con sesión iniciada, el perfil, el vehículo, los favoritos,
     las alertas y las opiniones se guardan en la base de datos
     y se recuperan desde cualquier dispositivo.
   - Solo se usa la clave PÚBLICA (js/config.js). La seguridad la
     ponen las reglas RLS de la base de datos.
   ========================================================== */
(() => {
  const cfg = window.LITROGO_CONFIG || {};
  const URL_OK = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.SUPABASE_URL || "");
  const CLAVE = String(cfg.SUPABASE_PUBLISHABLE_KEY || "");
  const ES_SECRETA = /^sb_secret_/.test(CLAVE) || /service_role/.test(atobSeguro(CLAVE.split(".")[1] || ""));
  if (ES_SECRETA) console.error("LitroGo: js/config.js contiene una clave SECRETA. Bórrala y usa la Publishable key.");
  const configurada = URL_OK && CLAVE.length > 20 && !ES_SECRETA;

  function atobSeguro(s) { try { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; } }

  // Los identificadores de combustible del navegador y de la base de datos
  const A_NUBE = { dieselp: "diesel_premium" };
  const DE_NUBE = { diesel_premium: "dieselp" };
  const combNube = (c) => A_NUBE[c] || c;
  const combLocal = (c) => DE_NUBE[c] || c;

  let cliente = null, promesa = null, usuario = null, sincronizando = null, silencioso = false;
  const emitir = (nombre, detalle) => window.dispatchEvent(new CustomEvent(nombre, { detail: detalle }));

  function cargarScript(src) {
    return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
  }

  async function iniciar() {
    if (!configurada) return null;
    if (promesa) return promesa;
    promesa = (async () => {
      if (!window.supabase?.createClient) {
        for (const src of ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js", "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js"]) {
          try { await cargarScript(src); if (window.supabase?.createClient) break; } catch {}
        }
      }
      if (!window.supabase?.createClient) throw new Error("No se pudo cargar la librería de Supabase.");
      cliente = window.supabase.createClient(cfg.SUPABASE_URL.replace(/\/$/, ""), CLAVE, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "litrogo-sesion" },
      });
      const { data } = await cliente.auth.getSession();
      usuario = data?.session?.user || null;
      cliente.auth.onAuthStateChange((evento, sesion) => {
        const antes = usuario?.id;
        usuario = sesion?.user || null;
        emitir("cambiosesion", { evento, usuario });
        if (evento === "PASSWORD_RECOVERY") emitir("recuperarcontrasena", {});
        if (evento === "SIGNED_IN" && usuario && antes !== usuario.id) sincronizar({ fusionar: true });
      });
      emitir("cambiosesion", { evento: "INICIAL", usuario });
      // al abrir cualquier página con sesión, se traen los datos de la nube (como mucho cada 2 minutos)
      if (usuario && Date.now() - GR.leer("nubeUltima", 0) > 120000) sincronizar();
      return cliente;
    })().catch((err) => { console.warn("LitroGo nube:", err); promesa = null; emitir("cambiosesion", { evento: "ERROR", usuario: null }); return null; });
    return promesa;
  }

  /* ---------- Mensajes de error comprensibles ---------- */
  function mensaje(error) {
    const m = String(error?.message || error || "");
    const c = String(error?.code || "");
    if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/Email not confirmed/i.test(m)) return "Todavía no has confirmado tu correo. Revisa tu bandeja de entrada (y la de spam).";
    if (/already registered|already been registered/i.test(m)) return "Ya existe una cuenta con ese correo. Prueba a entrar o a recuperar la contraseña.";
    if (/Password should be|weak|pwned|leaked/i.test(m)) return "Esa contraseña no es segura. Usa al menos 8 caracteres con letras y números, que no hayas usado en otros sitios.";
    if (c === "over_email_send_rate_limit" || /email rate limit/i.test(m)) return "Se ha alcanzado el límite de correos de LitroGo por ahora (el servidor solo envía unos pocos por hora). Si ya pulsaste antes, revisa tu correo y la carpeta de spam: puede que la cuenta ya esté creada. Si no, vuelve a probar en un rato.";
    const seg = m.match(/after (\d+) seconds?/i);
    if (seg) return `Por seguridad, espera ${seg[1]} segundos antes de volver a intentarlo.`;
    if (/rate limit|too many/i.test(m)) return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
    if (/LIMITE_PLAN/.test(m)) return "Has llegado al límite de tu cuenta gratuita. Se ha guardado en este dispositivo.";
    if (/DEMASIADAS_OPINIONES/.test(m)) return "Has publicado muchas opiniones hoy. Vuelve a intentarlo mañana.";
    if (c === "23505") return "Ya estaba guardado en tu cuenta.";
    if (c === "23503") return "Esta gasolinera aún no está en la base de datos; se guardará en tu cuenta en cuanto se importen los precios.";
    if (c === "23514") return "Algún dato no es válido. Revísalo e inténtalo de nuevo.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "No hay conexión con el servidor. Lo guardamos en este dispositivo y lo subiremos más tarde.";
    return "No se pudo completar. " + (m ? "(" + m.slice(0, 120) + ")" : "");
  }

  /* ---------- Cuenta ---------- */
  const urlVuelta = () => (location.protocol.startsWith("http") ? location.href.replace(/[^/]*([?#].*)?$/, "cuenta.html") : undefined);

  async function registrar({ correo, contrasena, nombre }) {
    const c = await iniciar(); if (!c) throw new Error("La cuenta no está configurada.");
    const { data, error } = await c.auth.signUp({
      email: correo, password: contrasena,
      options: { data: { nombre: String(nombre || "").slice(0, 60) }, emailRedirectTo: urlVuelta() },
    });
    if (error) throw new Error(mensaje(error));
    return { necesitaConfirmar: !data.session };
  }
  async function entrar({ correo, contrasena }) {
    const c = await iniciar(); if (!c) throw new Error("La cuenta no está configurada.");
    const { error } = await c.auth.signInWithPassword({ email: correo, password: contrasena });
    if (error) throw new Error(mensaje(error));
  }
  async function salir() {
    const c = await iniciar(); if (!c) return;
    await c.auth.signOut();
    usuario = null;
    // los datos de la cuenta no se quedan en un dispositivo que puede ser compartido
    ["favoritos", "alertas", "opiniones", "perfil", "nombre", "historial", "nubeFusion", "nubeUltima", "nubePendientes", "tipoCuenta"].forEach((k) => { try { localStorage.removeItem("gr_" + k); } catch {} });
    emitir("cambiosesion", { evento: "SIGNED_OUT", usuario: null });
  }
  async function recuperar(correo) {
    const c = await iniciar(); if (!c) throw new Error("La cuenta no está configurada.");
    const { error } = await c.auth.resetPasswordForEmail(correo, { redirectTo: urlVuelta() });
    if (error) throw new Error(mensaje(error));
  }
  async function nuevaContrasena(contrasena) {
    const c = await iniciar(); if (!c) throw new Error("La cuenta no está configurada.");
    const { error } = await c.auth.updateUser({ password: contrasena });
    if (error) throw new Error(mensaje(error));
  }
  async function exportar() {
    const c = await iniciar(); const { data, error } = await c.rpc("exportar_mis_datos"); if (error) throw new Error(mensaje(error)); return data;
  }
  async function borrarCuenta() {
    const c = await iniciar(); const { error } = await c.rpc("borrar_mi_cuenta"); if (error) throw new Error(mensaje(error));
    await salir();
  }

  /* ---------- Conversión entre el navegador y la base de datos ---------- */
  const alertaANube = (a) => a.tipo === "zona"
    ? { tipo: "zona", lat: a.lat, lon: a.lon, radio_km: a.radio, nombre_zona: (a.zona || "").slice(0, 120), combustible_id: combNube(a.combustible), precio_objetivo: a.objetivo }
    : { tipo: "gasolinera", gasolinera_id: a.estacionId, combustible_id: combNube(a.combustible), precio_objetivo: a.objetivo };
  const alertaALocal = (r) => ({
    id: "n" + r.id.slice(0, 8), nubeId: r.id, creada: Date.parse(r.creado_en) || Date.now(), ultimoAviso: null,
    combustible: combLocal(r.combustible_id), objetivo: Number(r.precio_objetivo),
    ...(r.tipo === "zona"
      ? { tipo: "zona", lat: r.lat, lon: r.lon, radio: Number(r.radio_km), zona: r.nombre_zona || "Tu zona" }
      : { tipo: "estacion", estacionId: r.gasolinera_id, nombre: r.gasolinera_id }),
  });

  async function fichasGasolineras(c, ids) {
    if (!ids.length) return new Map();
    const [g, p] = await Promise.all([
      c.from("gasolineras").select("id, rotulo, direccion, municipio, id_municipio, lat, lon, horario").in("id", ids),
      c.from("precios_actuales").select("gasolinera_id, combustible_id, precio").in("gasolinera_id", ids),
    ]);
    const m = new Map();
    (g.data || []).forEach((e) => m.set(e.id, { id: e.id, rotulo: e.rotulo, direccion: e.direccion, municipio: e.municipio, idMunicipio: e.id_municipio, lat: e.lat, lon: e.lon, horario: e.horario, precios: {} }));
    (p.data || []).forEach((x) => { const e = m.get(x.gasolinera_id); if (e) e.precios[combLocal(x.combustible_id)] = Number(x.precio); });
    return m;
  }

  /* ---------- Sincronización ----------
     La primera vez que se entra en un dispositivo se FUSIONA lo que hay en el
     navegador con la cuenta (no se pierde nada). Después, la cuenta manda. */
  function sincronizar(opc = {}) {
    if (!usuario) return Promise.resolve(null);
    if (sincronizando) return sincronizando;
    sincronizando = (async () => {
      const c = await iniciar(); const uid = usuario.id;
      const fusionar = opc.fusionar || GR.leer("nubeFusion", null) !== uid;
      const avisos = [];
      silencioso = true;
      try {
        // 1. Perfil y preferencias
        const { data: perf } = await c.from("perfiles").select("nombre, preferencias, tipo_cuenta").eq("id", uid).maybeSingle();
        const local = GR.perfil.leer();
        const prefLocal = { combustible: local.combustible, radio: local.radio, ubicacion: local.ubicacion, tema: GR.leer("tema", null) };
        if (perf) {
          const prefNube = perf.preferencias || {};
          const cambios = {};
          if (!perf.nombre && local.nombre) cambios.nombre = local.nombre.slice(0, 60);
          if (!Object.keys(prefNube).length) cambios.preferencias = prefLocal;
          if (Object.keys(cambios).length) await c.from("perfiles").update(cambios).eq("id", uid);
          const pref = Object.keys(prefNube).length ? prefNube : prefLocal;
          GR.perfil.guardar({ ...local, nombre: perf.nombre || local.nombre, combustible: pref.combustible || local.combustible, radio: pref.radio || local.radio, ubicacion: pref.ubicacion || local.ubicacion });
          if (pref.tema && pref.tema !== GR.temaActual()) GR.ponerTema(pref.tema);
          GR.guardar("tipoCuenta", perf.tipo_cuenta);
        }

        // 2. Vehículo principal
        const { data: veh } = await c.from("vehiculos").select("*").eq("principal", true).maybeSingle();
        const pl = GR.perfil.leer();
        if (veh) {
          GR.perfil.guardar({ ...pl, marca: veh.marca, modelo: veh.modelo, anio: veh.anio || "", vehiculo: `${veh.marca} ${veh.modelo}`.trim(),
            consumo: Number(veh.consumo_medio) || pl.consumo, deposito: Number(veh.deposito_litros) || pl.deposito, combustible: combLocal(veh.combustible_id) || pl.combustible });
        } else if (fusionar) {
          const r = await c.from("vehiculos").insert(vehiculoANube(pl, true));
          if (r.error) avisos.push(mensaje(r.error));
        }

        // 3. Favoritos
        const { data: favNube, error: eFav } = await c.from("favoritos").select("gasolinera_id, creado_en");
        if (!eFav) {
          const idsNube = new Set((favNube || []).map((f) => f.gasolinera_id));
          const favLocal = GR.favoritos.todos();
          const pendientes = new Set(GR.leer("nubePendientes", []));
          // se suben: todo lo local la primera vez, y en cada sincronización los pendientes
          for (const f of favLocal.filter((f) => !idsNube.has(f.id) && (fusionar || pendientes.has(f.id)))) {
            const r = await c.from("favoritos").insert({ gasolinera_id: f.id });
            if (!r.error || r.error.code === "23505") { idsNube.add(f.id); pendientes.delete(f.id); }
            else if (r.error.code === "23503") pendientes.add(f.id);      // gasolinera aún no importada: se reintenta
            else { avisos.push(mensaje(r.error)); pendientes.delete(f.id); }
          }
          const conocidos = new Map(favLocal.map((f) => [f.id, f]));
          const faltan = [...idsNube].filter((id) => !conocidos.has(id));
          const fichas = await fichasGasolineras(c, faltan);
          const nueva = [...idsNube].map((id) => conocidos.get(id) || fichas.get(id)).filter(Boolean);
          // los pendientes se conservan en este dispositivo hasta que se puedan subir
          favLocal.forEach((f) => { if (!idsNube.has(f.id) && pendientes.has(f.id)) nueva.push(f); });
          GR.guardar("favoritos", nueva);
          GR.guardar("nubePendientes", [...pendientes]);
        }

        // 4. Alertas
        const { data: alNube, error: eAl } = await c.from("alertas").select("*").neq("estado", "cumplida");
        if (!eAl) {
          let alLocal = GR.alertas.todas();
          if (fusionar) {
            for (const a of alLocal.filter((a) => !a.nubeId)) {
              const r = await c.from("alertas").insert(alertaANube(a)).select("id").single();
              if (r.error) avisos.push(mensaje(r.error)); else a.nubeId = r.data.id;
            }
          }
          const enNube = new Map((alNube || []).map((r) => [r.id, r]));
          alLocal.forEach((a) => { if (a.nubeId && !enNube.has(a.nubeId) && fusionar) enNube.set(a.nubeId, null); });
          const resultado = [];
          enNube.forEach((r, id) => { const loc = alLocal.find((a) => a.nubeId === id); resultado.push(loc ? { ...loc, objetivo: r ? Number(r.precio_objetivo) : loc.objetivo } : alertaALocal(r)); });
          alLocal.filter((a) => !a.nubeId).forEach((a) => resultado.push(a));   // las que no se pudieron subir
          GR.alertas.guardar(resultado.filter((a) => a));
        }

        // 5. Opiniones escritas en el navegador antes de tener cuenta
        if (fusionar) {
          const op = GR.opiniones.todas();
          for (const [gid, lista] of Object.entries(op)) {
            const o = lista[0]; if (!o || o.nube) continue;
            const r = await c.from("opiniones").insert({ gasolinera_id: gid, valoracion: o.nota, comentario: o.texto });
            if (!r.error || r.error.code === "23505") o.nube = true; else avisos.push(mensaje(r.error));
          }
          GR.guardar("opiniones", op);
        }

        GR.guardar("nubeFusion", uid);
        GR.guardar("nubeUltima", Date.now());
        emitir("nubesincronizada", { avisos: [...new Set(avisos)] });
        return { avisos };
      } catch (err) {
        console.warn("LitroGo sincronizar:", err);
        emitir("nubesincronizada", { avisos: [mensaje(err)], error: true });
        return { avisos: [mensaje(err)], error: true };
      } finally {
        silencioso = false;
        sincronizando = null;
      }
    })();
    return sincronizando;
  }

  const vehiculoANube = (p, principal) => {
    const [marca, ...resto] = String(p.marca || p.vehiculo || "Mi coche").trim().split(/\s+/);
    return {
      marca: (p.marca || marca || "Mi coche").slice(0, 40), modelo: (p.modelo || resto.join(" ") || "Sin modelo").slice(0, 60),
      anio: p.anio ? Number(p.anio) : null, combustible_id: combNube(p.combustible || "g95"),
      consumo_medio: p.consumo || null, deposito_litros: p.deposito || null, principal,
    };
  };

  /* ---------- Guardar en la nube cada cambio (si hay sesión) ---------- */
  function avisar(err, titulo = "Guardado solo en este dispositivo") { GR.toast(titulo, mensaje(err), "alerta", 7000); }
  async function enNube(fn) {
    if (!usuario || silencioso) return;
    try { const c = await iniciar(); if (c) await fn(c); } catch (err) { avisar(err); }
  }
  function envolver() {
    const f = GR.favoritos, al = GR.alertas, pf = GR.perfil, op = GR.opiniones;
    const alternar = f.alternar, quitarF = f.quitar;
    f.alternar = (e) => {
      const on = alternar(e);
      enNube(async (c) => {
        const r = on ? await c.from("favoritos").insert({ gasolinera_id: e.id }) : await c.from("favoritos").delete().eq("gasolinera_id", e.id);
        if (r.error && r.error.code !== "23505") {
          if (r.error.code === "23503") GR.guardar("nubePendientes", [...new Set([...GR.leer("nubePendientes", []), e.id])]);
          avisar(r.error);
        }
      });
      return on;
    };
    f.quitar = (id) => { quitarF(id); enNube((c) => c.from("favoritos").delete().eq("gasolinera_id", id)); };

    const anadir = al.anadir, quitarA = al.quitar;
    al.anadir = (a) => {
      anadir(a);
      const local = al.todas()[0];
      enNube(async (c) => {
        const r = await c.from("alertas").insert(alertaANube(local)).select("id").single();
        if (r.error) return avisar(r.error);
        const l = al.todas(); const x = l.find((y) => y.id === local.id); if (x) { x.nubeId = r.data.id; al.guardar(l); }
      });
    };
    al.quitar = (id) => {
      const a = al.todas().find((x) => x.id === id);
      quitarA(id);
      if (a?.nubeId) enNube((c) => c.from("alertas").delete().eq("id", a.nubeId));
    };

    const guardarPerfil = pf.guardar;
    pf.guardar = (p) => {
      guardarPerfil(p);
      enNube(async (c) => {
        const pref = { combustible: p.combustible, radio: p.radio, ubicacion: p.ubicacion, tema: GR.leer("tema", null) };
        const r1 = await c.from("perfiles").update({ nombre: String(p.nombre || "").slice(0, 60), preferencias: pref }).eq("id", usuario.id);
        if (r1.error) return avisar(r1.error);
        const { data: veh } = await c.from("vehiculos").select("id").eq("principal", true).maybeSingle();
        const datosVeh = vehiculoANube(p, true);
        const r2 = veh ? await c.from("vehiculos").update(datosVeh).eq("id", veh.id) : await c.from("vehiculos").insert(datosVeh);
        if (r2.error) avisar(r2.error);
      });
    };

    const anadirOp = op.anadir;
    op.anadir = (id, o) => {
      anadirOp(id, o);
      enNube(async (c) => {
        const r = await c.from("opiniones").insert({ gasolinera_id: id, valoracion: o.nota, comentario: o.texto });
        if (r.error && r.error.code === "23505") {
          const r2 = await c.from("opiniones").update({ valoracion: o.nota, comentario: o.texto }).eq("gasolinera_id", id);
          if (r2.error) avisar(r2.error);
        } else if (r.error) avisar(r.error, "No se pudo publicar");
        else { const t = op.todas(); if (t[id]?.[0]) { t[id][0].nube = true; GR.guardar("opiniones", t); } }
        emitir("opinionpublicada", { gasolinera: id });
      });
    };
  }

  /* ---------- Opiniones públicas (con o sin cuenta) ---------- */
  async function opinionesDe(gasolinera) {
    const c = await iniciar(); if (!c) return null;
    const [l, v] = await Promise.all([c.rpc("opiniones_de", { p_gasolinera: gasolinera }), c.rpc("valoracion_de", { p_gasolinera: gasolinera })]);
    if (l.error) throw new Error(mensaje(l.error));
    const media = v.data && v.data[0] ? Number(v.data[0].media) || null : null;
    return { lista: (l.data || []).map((o) => ({ nombre: o.autor, nota: o.valoracion, texto: o.comentario, fecha: Date.parse(o.creado_en), mia: o.es_mia })), media, total: v.data?.[0]?.total || 0 };
  }

  envolver();
  GR.nube = {
    configurada, iniciar, usuario: () => usuario, registrar, entrar, salir, recuperar, nuevaContrasena,
    sincronizar, exportar, borrarCuenta, opinionesDe, mensaje,
  };
  if (configurada) iniciar();
})();
