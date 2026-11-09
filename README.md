# En Casa — Edu & Minerva 🏡

App web colaborativa y adaptable a móvil, preparada para Replit. Interfaz en español y estilo cálido.

## Funciones

- Dos perfiles: Edu y Minerva, protegidos por un **código compartido** (mínimo ocho caracteres).
- Tareas por día, semanales, quincenales (cada 14 días) y mensuales.
- Marcado de completadas, reasignación puntual y actividad reciente sincronizada.
- Alta, edición y eliminación de tareas y selección de responsable.
- Horarios de **prácticas**, **turno de mañana** y **turno de tarde** para Minerva.
- Tareas de los gatos, cocina/táper, suelo diario, dormitorios, baños, terrazas, etc.
- Alergia de Edu: **quitar polvo asignado a Minerva**.
- Diseño responsive y opción de añadir a la pantalla de inicio (PWA básica).

## Desarrollo local

Se necesita Node.js 20 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:3000`. En local, sin `DATABASE_URL`, se guarda en `.data/hogar.json`.

## Publicación gratuita en Render + Neon

1. En **Neon**, crea un proyecto (región Frankfurt) y copia la *connection string* (`postgresql://…?sslmode=require`). No la subas a Git.
2. En **Render**, pulsa **New → Blueprint** y selecciona este repositorio. Render lee `render.yaml` y crea el servicio `en-casa-edu-minerva` en el plan **Free**.
3. Cuando te pida `DATABASE_URL`, pega la conexión de Neon. `APP_SECRET` se genera solo; `REQUIRE_POSTGRES=1` impide arrancar sin base de datos.
4. Comprueba `https://<tu-servicio>.onrender.com/api/health` → `{"ok":true,"backend":"postgres"}`.

Render Free suspende el servicio tras 15 minutos sin uso; la primera carga posterior tarda alrededor de un minuto. Los datos se mantienen en Neon.

## Publicación en Replit

1. Importa los archivos de este ZIP como proyecto **Node.js** en Replit.
2. En el entorno del proyecto, instala dependencias (`npm install`) y configura **PostgreSQL** (la base de datos gestionada de Replit). Asegúrate de que la URL de la base de datos esté disponible como **secreto `DATABASE_URL`**, también en el entorno de publicación.
3. Añade un secreto `APP_SECRET` con **al menos 32 caracteres aleatorios**. No lo compartas ni lo subas a Git.
4. Ejecuta `npm start` y abre la vista previa. Comprueba `GET /api/health`: en una publicación con base de datos debe responder `"backend":"postgres"`.
5. Publica desde Replit (Deploy/Publish) usando el puerto `process.env.PORT`. Revisa los posibles costes según tu plan de Replit.
6. Abre la URL publicada, elige un perfil, crea un código de acceso de 8 o más caracteres y compártelo **por un canal privado** con tu pareja. No publiques el PIN en el código ni en Git.
7. En cada móvil, abre la URL y usa **Añadir a pantalla de inicio** para tener acceso rápido.

**No publiques con el almacenamiento local de desarrollo**: los archivos locales pueden no persistir en los despliegues y se perderían las tareas completadas. Replit PostgreSQL es esencial para sincronización y persistencia entre dispositivos.

## Seguridad y limitaciones

- Acceso mediante un PIN compartido: suficiente para un hogar pequeño, pero no son cuentas individuales con contraseñas distintas. Cualquiera que conozca el PIN puede usar ambos perfiles; no reutilices contraseñas personales.
- Las sesiones están firmadas con HMAC y el PIN se almacena mediante `scrypt` con sal aleatoria.
- El estado y el historial se guardan en una única tabla de PostgreSQL.
- Se consulta el servidor cada 12 segundos cuando la app está activa; no es sincronización instantánea por WebSocket.
- La app **no envía notificaciones push** ni mensajes automáticos.
- Las tareas iniciales son **orientativas**: se pueden modificar en la pantalla *Todas las tareas*.

## Pruebas

```bash
npm test
```
