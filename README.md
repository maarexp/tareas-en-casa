# En Casa — Edu y Minerva

La app permite que los dos veáis y cambiéis las mismas tareas, con usuarios Edu y Minerva, código familiar de acceso, tareas recurrentes y marcas sincronizadas.

## Publicación gratuita: Render + Neon PostgreSQL

Render Free se duerme tras 15 minutos sin tráfico y puede tardar alrededor de un minuto en reactivarse. El PostgreSQL Free de Render caduca a los 30 días, por eso usamos **Neon**, no la base de datos de Render. Su plan gratuito tiene límites de uso y almacenamiento.

1. Crea un proyecto gratuito en https://neon.com (región Frankfurt) y copia su **connection string** PostgreSQL desde `Connect` (con `sslmode=require`). Mantén la cadena privada.
2. En https://dashboard.render.com pulsa **New → Blueprint** y selecciona este repositorio. `render.yaml` crea el servicio `en-casa-edu-minerva` en el plan **Free** (región Frankfurt).
3. Cuando lo pida, pega en `DATABASE_URL` la conexión de Neon. El Blueprint configura el resto:
   - `APP_SECRET`: se genera automáticamente.
   - `REQUIRE_POSTGRES`: `1`.
   - `NODE_ENV`: `production`.
4. Pulsa **Deploy Blueprint**. Verifica `https://<tu-servicio>.onrender.com/api/health` y que diga `"backend":"postgres"`.
5. Abre la dirección desde ambos móviles; configura el PIN familiar una sola vez.

**Importante:** si no hay `DATABASE_URL`, el servidor se detendrá en Render para evitar que guardéis tareas en un disco efímero. El alojamiento gratuito no garantiza disponibilidad continua y puede tener límites de uso. Conviene exportar copias de seguridad de la base de datos.

## Desarrollo local

Con Node.js 20 o superior:

```bash
npm install
npm start
```

Abre `http://localhost:3000`. Sin `DATABASE_URL`, los datos se guardan en `.data/hogar.json` (solo para pruebas).

## Características y seguridad

- PIN compartido y perfiles Edu y Minerva: no son dos cuentas independientes.
- Los datos se guardan en PostgreSQL (Neon), visibles desde ambos dispositivos.
- Sin notificaciones push; sincronización mediante comprobaciones periódicas (aprox. 12 segundos).
- No subas `.env`, el PIN ni `DATABASE_URL` a repositorios públicos o capturas.
- Una vez publicada, la web se puede añadir a la pantalla de inicio del móvil.

Pruebas: `npm test` con Node.js 20+.
