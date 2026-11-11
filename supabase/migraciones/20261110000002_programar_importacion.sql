-- =====================================================================
-- LitroGo · Programar la importación de precios cada 30 minutos
-- Ejecutar DESPUÉS de desplegar la Edge Function "importar-precios".
--
-- Antes de ejecutarlo, sustituye:
--   https://TU-PROYECTO.supabase.co  → tu Project URL
--   CAMBIA-ESTE-SECRETO               → la misma cadena larga que pusiste
--                                       en el secreto CRON_SECRET de la función
-- Los dos valores se guardan cifrados en Supabase Vault, no en el código.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://TU-PROYECTO.supabase.co', 'litrogo_url', 'URL del proyecto LitroGo');
select vault.create_secret('CAMBIA-ESTE-SECRETO', 'litrogo_cron', 'Secreto para llamar a importar-precios');

select cron.schedule(
  'litrogo-importar-precios',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'litrogo_url') || '/functions/v1/importar-precios',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-litrogo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'litrogo_cron')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Para lanzarla una vez a mano (por ejemplo, justo después de crearla):
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'litrogo_url') || '/functions/v1/importar-precios',
--     headers := jsonb_build_object('Content-Type','application/json','x-litrogo-cron',
--                (select decrypted_secret from vault.decrypted_secrets where name = 'litrogo_cron')),
--     body := '{}'::jsonb, timeout_milliseconds := 120000);
-- Para ver el resultado: select * from net._http_response order by id desc limit 5;
