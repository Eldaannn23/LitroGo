-- =====================================================================
-- LitroGo · Datos iniciales de los catálogos
-- Ejecutar después de la migración del esquema.
-- =====================================================================

insert into public.combustibles (id, nombre, campo_ministerio, orden) values
  ('g95',            'Gasolina 95',            'Precio Gasolina 95 E5',              1),
  ('g98',            'Gasolina 98',            'Precio Gasolina 98 E5',              2),
  ('diesel',         'Diésel',                 'Precio Gasoleo A',                   3),
  ('diesel_premium', 'Diésel Premium',         'Precio Gasoleo Premium',             4),
  ('glp',            'GLP',                    'Precio Gases licuados del petróleo', 5),
  ('gnc',            'Gas natural comprimido', 'Precio Gas Natural Comprimido',      6),
  ('gnl',            'Gas natural licuado',    'Precio Gas Natural Licuado',         7),
  ('hidrogeno',      'Hidrógeno',              'Precio Hidrogeno',                   8),
  ('adblue',         'AdBlue',                 'Precio Adblue',                      9)
on conflict (id) do nothing;

insert into public.servicios (id, nombre) values
  ('24h',          'Abierta 24 horas'),
  ('lavado',       'Lavado'),
  ('tienda',       'Tienda'),
  ('cafeteria',    'Cafetería'),
  ('aire_agua',    'Aire y agua'),
  ('aseos',        'Aseos'),
  ('recarga',      'Recarga eléctrica'),
  ('autoservicio', 'Autoservicio'),
  ('pago_movil',   'Pago con el móvil')
on conflict (id) do nothing;

-- Límites por cuenta (se pueden cambiar sin tocar el código)
insert into public.limites_plan (plan, max_favoritos, max_alertas, max_vehiculos) values
  ('gratuita', 10, 3, 2),
  ('premium', 500, 50, 10)
on conflict (plan) do update set
  max_favoritos = excluded.max_favoritos, max_alertas = excluded.max_alertas, max_vehiculos = excluded.max_vehiculos;
