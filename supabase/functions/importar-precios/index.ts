// =====================================================================
// LitroGo · Edge Function "importar-precios"
// Descarga los precios oficiales del Ministerio, los guarda en la base
// de datos y marca las alertas cumplidas (y envía avisos push si están
// configurados).
//
// Se ejecuta cada 30 minutos desde pg_cron (ver la migración 002).
// Despliegue: Supabase → Edge Functions → Deploy a new function →
//   nombre "importar-precios", pegar este archivo y desactivar
//   "Verify JWT" (la protege el secreto CRON_SECRET).
// Secretos de la función (Edge Functions → Secrets):
//   CRON_SECRET          → una cadena larga y aleatoria (la misma que en Vault)
//   VAPID_PUBLIC_KEY     → opcional, para los avisos push
//   VAPID_PRIVATE_KEY    → opcional
//   VAPID_CONTACTO       → opcional, p. ej. "mailto:hola@litrogo.es"
// La clave secreta de Supabase la pone el propio Supabase en el entorno.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";
const CAMPOS: Record<string, string> = {
  g95: "Precio Gasolina 95 E5",
  g98: "Precio Gasolina 98 E5",
  diesel: "Precio Gasoleo A",
  diesel_premium: "Precio Gasoleo Premium",
  glp: "Precio Gases licuados del petróleo",
  gnc: "Precio Gas Natural Comprimido",
  gnl: "Precio Gas Natural Licuado",
  hidrogeno: "Precio Hidrogeno",
  adblue: "Precio Adblue",
};
const LOTE = 2000;

const num = (s: unknown) => {
  if (s === undefined || s === null || s === "") return null;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// "10/11/2026 9:12:44" (hora de Madrid) → instante ISO
function fechaMinisterio(txt: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec((txt || "").trim());
  if (!m) return new Date().toISOString();
  const [, d, mes, a, h, mi, se] = m.map(Number) as unknown as number[];
  const comoUTC = Date.UTC(a, mes - 1, d, h, mi, se);
  // diferencia entre UTC y Madrid en ese momento (1 h en invierno, 2 h en verano)
  const madrid = new Date(new Date(comoUTC).toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const utc = new Date(new Date(comoUTC).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(comoUTC - (madrid.getTime() - utc.getTime())).toISOString();
}

function convertir(e: Record<string, string>) {
  const lat = num(e["Latitud"]), lon = num(e["Longitud (WGS84)"]);
  if (lat === null || lon === null || lat < 27 || lat > 44.5 || lon < -18.5 || lon > 4.6) return null;
  const precios: Record<string, number> = {};
  for (const [id, campo] of Object.entries(CAMPOS)) {
    const p = num(e[campo]);
    if (p !== null && p > 0.2 && p < 9.999) precios[id] = p;
  }
  const cp = (e["C.P."] || "").trim();
  return {
    id: e["IDEESS"], rotulo: (e["Rótulo"] || "").trim().slice(0, 120), direccion: (e["Dirección"] || "").trim().slice(0, 250),
    localidad: e["Localidad"], municipio: e["Municipio"], id_municipio: e["IDMunicipio"], provincia: e["Provincia"],
    cp: /^\d{5}$/.test(cp) ? cp : "", lat, lon, horario: (e["Horario"] || "").slice(0, 300),
    tipo_venta: ["P", "R"].includes(e["Tipo Venta"]) ? e["Tipo Venta"] : "",
    margen: ["D", "I", "N"].includes(e["Margen"]) ? e["Margen"] : "",
    precios,
  };
}

function claveSecreta(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (nuevas.default) return nuevas.default;
  } catch { /* se usa la antigua */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("CRON_SECRET");
  if (!secreto || req.headers.get("x-litrogo-cron") !== secreto) {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, claveSecreta(), { auth: { persistSession: false } });
  const inicio = Date.now();

  // 1. Descargar del Ministerio
  const r = await fetch(API, { headers: { Accept: "application/json", "User-Agent": "LitroGo/1.0 (importador de precios)" } });
  if (!r.ok) return new Response(JSON.stringify({ error: "Ministerio HTTP " + r.status }), { status: 502 });
  const j = await r.json();
  const fecha = fechaMinisterio(j.Fecha);
  const estaciones = (j.ListaEESSPrecio || []).map(convertir).filter(Boolean);
  if (estaciones.length < 1000) {
    // protección: si el Ministerio devuelve una lista anómala, no se toca nada
    return new Response(JSON.stringify({ error: "lista anómala", estaciones: estaciones.length }), { status: 502 });
  }

  // 2. Guardar por lotes
  let cambios = 0;
  for (let i = 0; i < estaciones.length; i += LOTE) {
    const { data, error } = await db.rpc("importar_precios", { p_datos: estaciones.slice(i, i + LOTE), p_fecha: fecha });
    if (error) return new Response(JSON.stringify({ error: error.message, lote: i }), { status: 500 });
    cambios += data || 0;
  }

  // 3. Alertas cumplidas
  const { data: alertas, error: eAl } = await db.rpc("alertas_a_notificar");
  let avisadas = 0, push = 0;
  if (!eAl && alertas?.length) {
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY"), vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
    let webpush: any = null;
    if (vapidPub && vapidPriv) {
      webpush = (await import("npm:web-push@3")).default;
      webpush.setVapidDetails(Deno.env.get("VAPID_CONTACTO") || "mailto:hola@litrogo.es", vapidPub, vapidPriv);
    }
    for (const a of alertas) {
      if (webpush) {
        const { data: subs } = await db.from("suscripciones_push").select("endpoint, p256dh, auth_clave").eq("usuario_id", a.usuario_id);
        for (const s of subs || []) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_clave } },
              JSON.stringify({ titulo: "Bajada de precio", texto: `${a.rotulo}: ${Number(a.precio).toFixed(3)} €/L (tu objetivo: ${Number(a.precio_objetivo).toFixed(3)})`, url: "/alertas.html" }));
            push++;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) await db.from("suscripciones_push").delete().eq("endpoint", s.endpoint);
          }
        }
      }
      await db.from("alertas").update({ ultimo_aviso_en: new Date().toISOString(), ultimo_precio: a.precio }).eq("id", a.alerta_id);
      avisadas++;
    }
  }

  return new Response(JSON.stringify({ ok: true, fecha, estaciones: estaciones.length, cambios, avisadas, push, ms: Date.now() - inicio }),
    { headers: { "Content-Type": "application/json" } });
});
