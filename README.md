# En Casa — Edu y Minerva | Publicación sin pagar Replit

La app permite que los dos veáis y cambiéis las mismas tareas, con usuarios Edu y Minerva, código familiar de acceso, tareas recurrentes y marcas sincronizadas.

## Opción A (recomendada): tu VPS actual, sin coste adicional

La aplicación usa Docker y guarda los datos en un volumen persistente del VPS: **NO necesitas comprar una base de datos**.

### 1. Poner en marcha

Requisitos: Docker, Docker Compose (plugin), Nginx y un subdominio apuntando al VPS.

1. Copia esta carpeta al VPS, por ejemplo en `/opt/en-casa`.
2. En `/opt/en-casa` ejecuta:

```bash
cp .env.example .env
printf 'APP_SECRET=%s\n' "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:3100/api/health
```

La respuesta de `/api/health` debe contener `"backend":"persistent-file"`.
El puerto 3100 está limitado a `127.0.0.1` y no se expone directamente a Internet.

### 2. Subdominio con HTTPS

Crea un registro DNS A para `tareas.embasdf.cat` apuntando a la IP pública de tu VPS (o utiliza otro subdominio). Ajusta `server_name` en `nginx-tareas.conf` si hace falta y ejecuta:

```bash
sudo cp nginx-tareas.conf /etc/nginx/sites-available/tareas
sudo ln -s /etc/nginx/sites-available/tareas /etc/nginx/sites-enabled/tareas
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tareas.embasdf.cat
```

Si ya existe el enlace simbólico, no lo crees otra vez. No modifiques otras configuraciones de tu VPS.
La app quedará en `https://tareas.embasdf.cat` si has configurado correctamente DNS y certificado.

### 3. Acceso y mantenimiento

En la primera visita, crea un código familiar de al menos 8 caracteres y elige el perfil. El segundo móvil entra con ese mismo código, eligiendo el otro perfil. No empleéis la contraseña de cuentas personales.

```bash
# Logs
cd /opt/en-casa && docker compose logs -f --tail=80

# Copia de seguridad del calendario, en el equipo VPS
cd /opt/en-casa && docker compose exec -T en-casa cat /data/hogar.json > "en-casa-copia-$(date +%Y-%m-%d).json"

# Actualizaciones sin destruir los datos
cd /opt/en-casa && docker compose up -d --build
```

**No ejecutes `docker compose down -v`**, porque `-v` elimina el volumen con los datos. Haz copias de seguridad periódicas.

## Opción B (hosting gratuito externo): Render + Neon PostgreSQL

A diferencia del VPS, Render Free se duerme tras 15 minutos sin tráfico y puede tardar alrededor de un minuto en reactivarse. El PostgreSQL Free de Render caduca a los 30 días, por eso usamos **Neon**, no la base de datos de Render. Su plan gratuito tiene límites de uso y almacenamiento.

1. Crea un proyecto gratuito en https://neon.com y copia su **connection string** PostgreSQL desde `Connect` (con `sslmode=require`). Mantén la cadena privada.
2. Sube estos archivos a un repositorio **privado** de GitHub. `render.yaml` permite crear el servicio desde un Blueprint, o puedes crear manualmente un Web Service Node.js en https://dashboard.render.com.
3. En Render selecciona `Free`, configuración `npm install --omit=dev` / `npm start`, y añade los secrets:
   - `DATABASE_URL`: conexión de Neon.
   - `APP_SECRET`: 32 caracteres aleatorios como mínimo (el Blueprint lo genera).
   - `REQUIRE_POSTGRES`: `1`.
4. Publica. Verifica `https://<tu-servicio>.onrender.com/api/health` y que diga `"backend":"postgres"`.
5. Abre la dirección desde ambos móviles; configura el PIN familiar una sola vez.

**Importante:** si no hay `DATABASE_URL`, el servidor se detendrá en Render para evitar que guardéis tareas en un disco efímero. El alojamiento gratuito no garantiza disponibilidad continua y puede tener límites de uso. Conviene exportar copias de seguridad de la base de datos.

## Características y seguridad

- PIN compartido y perfiles Edu y Minerva: no son dos cuentas independientes.
- Los datos permanecen en un archivo duradero (en VPS) o en PostgreSQL (Render+Neon), visibles desde ambos dispositivos.
- Sin notificaciones push; sincronización mediante comprobaciones periódicas (aprox. 12 segundos).
- No es necesario pagar por Replit ni activar servicios de pago.
- No subas `.env`, el PIN ni `DATABASE_URL` a repositorios públicos o capturas.
- Una vez publicada, la web se puede añadir a la pantalla de inicio del móvil.

Pruebas: `npm test` con Node.js 20+.
