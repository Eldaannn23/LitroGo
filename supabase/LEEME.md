# LitroGo · Base de datos y cuentas (Supabase)

La web funciona sin esto. Cuando lo configures, aparecerá el inicio de sesión (opcional) en **Mi cuenta** y los datos de cada usuario se guardarán en la base de datos.

## Archivos

| Archivo | Para qué |
| --- | --- |
| `migraciones/20261110000001_esquema_inicial.sql` | Crea las 17 tablas, las funciones, los disparadores y toda la seguridad (RLS) |
| `semillas.sql` | Rellena los catálogos: combustibles, servicios y límites por tipo de cuenta |
| `functions/importar-precios/index.ts` | Edge Function: descarga los precios del Ministerio y avisa de las alertas cumplidas |
| `migraciones/20261110000002_programar_importacion.sql` | Ejecuta la función cada 30 minutos |
| `pruebas/` | Pruebas de seguridad en un PostgreSQL local (no ejecutar en Supabase) |

## Puesta en marcha (unos 15 minutos)

1. **Crea el proyecto** en [supabase.com](https://supabase.com): New project → nombre `litrogo` → región **Central EU (Frankfurt)** o **West EU (Ireland)**.
2. **Crea las tablas**: SQL Editor → pega `migraciones/20261110000001_esquema_inicial.sql` → Run. Después, `semillas.sql` → Run.
3. **Configura el correo**: Authentication → Sign In / Providers → Email: deja activada la confirmación del correo. En Authentication → URL Configuration pon la dirección donde publiques la web (por ejemplo `https://litrogo.netlify.app`) en *Site URL* y en *Redirect URLs*.
4. **Importa los precios** (necesario para guardar favoritos y opiniones en la nube):
   - Edge Functions → Deploy a new function → nombre `importar-precios` → pega `functions/importar-precios/index.ts` → desactiva **Verify JWT** → Deploy.
   - Edge Functions → Secrets → añade `CRON_SECRET` con una cadena larga y aleatoria.
   - SQL Editor → abre `migraciones/20261110000002_programar_importacion.sql`, cambia la URL y el secreto y ejecútalo. Lanza la primera importación con la consulta del final del archivo.
5. **Conecta la web**: Project Settings → API Keys → copia la **Project URL** y la **Publishable key** (`sb_publishable_...`) en `js/config.js`.
6. **Publica la web** en `https://` (Netlify, Cloudflare Pages o GitHub Pages). Abierta con doble clic funciona el inicio de sesión, pero no los enlaces de confirmación ni los de recuperar la contraseña.

**Nunca** pongas la **Secret key** (`sb_secret_...`) ni la `service_role` en `js/config.js`: se saltan todas las reglas. La web lo detecta y se niega a usarla.

## Qué se sincroniza

| Dato | Sin cuenta | Con cuenta |
| --- | --- | --- |
| Favoritos, alertas, vehículo principal, nombre y preferencias | En este navegador | En la cuenta, en todos los dispositivos |
| Opiniones | Solo las ves tú | Públicas, con el nombre que elijas |
| Comparador, última búsqueda, calculadora | En este navegador | En este navegador (no son datos personales) |

La primera vez que entras en un dispositivo, lo que tenías guardado en él se suma a tu cuenta. Al cerrar sesión, los datos personales se borran de ese dispositivo y siguen en la cuenta.

## Pruebas en local

```bash
python3 pruebas/ejecutar_pruebas.py "host=localhost port=5432 user=postgres"
```
