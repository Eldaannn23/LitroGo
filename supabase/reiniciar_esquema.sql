-- =====================================================================
-- LitroGo · Deshacer el esquema inicial
-- Úsalo SOLO si el esquema se quedó a medias en un proyecto nuevo y
-- quieres empezar de cero. Borra las tablas de LitroGo y sus datos.
-- No toca las cuentas de Supabase Auth ni nada que no sea de LitroGo.
-- =====================================================================
begin;
drop trigger if exists al_crear_usuario on auth.users;
drop view if exists public.gasto_mensual;
drop table if exists public.ofertas, public.patrocinios, public.suscripciones_push, public.reportes_opinion,
  public.opiniones, public.alertas, public.repostajes, public.favoritos, public.vehiculos, public.perfiles,
  public.historial_precios, public.precios_actuales, public.gasolinera_servicios, public.gasolineras,
  public.limites_plan, public.servicios, public.combustibles cascade;
drop function if exists public.crear_perfil_nuevo_usuario(), public.marcar_actualizado(), public.comprobar_limite_plan(),
  public.limitar_opiniones(), public.revisar_reportes(), public.registrar_historial(), public.completar_repostaje(),
  public.distancia_km(double precision, double precision, double precision, double precision),
  public.gasolineras_cercanas(double precision, double precision, double precision, text),
  public.opiniones_de(text), public.valoracion_de(text), public.consumo_real(uuid), public.exportar_mis_datos(),
  public.borrar_mi_cuenta(), public.importar_precios(jsonb, timestamptz), public.alertas_a_notificar() cascade;
drop type if exists public.tipo_cuenta, public.estado_alerta, public.tipo_alerta, public.estado_opinion cascade;
commit;
