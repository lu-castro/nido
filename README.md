# Nido

Tu vida en un solo lugar: tu semana, plata, trámites, turnos médicos, proyectos y vacaciones.
Nace de "Mis Gastos", que sigue funcionando aparte: Nido trae lo que tenías cargado ahí
(de la compu y del celu) y desde ese momento cada app guarda lo suyo por separado.
Es 100% gratis: se publica con GitHub Pages y los datos quedan guardados en tu celu
(con backup opcional en un Gist secreto de GitHub, que sincroniza compu y celu).

## Qué tiene

Las secciones están en la barra de arriba (en el celu, deslizala de costado para ver todas).

- **Inicio**: tu agenda de hoy, mañana y la semana (turnos, vencimientos, tareas, planes y
  viajes), lo atrasado en rojo, cuánta plata te queda en el mes y accesos rápidos para cargar cosas.
- **Mi semana**: una columna por día con todo lo que tenés (aparecen solos tus turnos, trámites,
  tareas con fecha y viajes). Sumás planes escribiendo en cada día; si empezás con la hora
  ("18:30 gym") queda ordenado por horario. Arriba, los objetivos de la semana para ir tildando.
- **Finanzas**: todo lo de antes (gastos, resumen, ingresos y ahorro), con el informe de
  fin de mes y tu plan de mejora.
- **Trámites**: estado (por empezar, en curso, esperando respuesta, listo), organismo,
  vencimiento, turno, N° de expediente y la lista de papeles que necesitás, para ir tildando.
- **Turnos médicos**: especialidad, profesional, fecha y hora, lugar y qué tenés que llevar.
  Si conectás Google Calendar, se sincronizan solos (ver abajo).
- **Proyectos**: tablero estilo Trello, con una columna por proyecto y sus tareas como tarjetas.
  En la compu arrastrás una tarea de un proyecto a otro; en el celu la tocás y elegís el proyecto.
  También hay una columna de "Tareas sueltas".
- **Vacaciones**: cada viaje con fechas y cuenta regresiva, presupuesto y gastos, reservas
  pendientes (pasajes, alojamiento, seguro…), lista para la valija, itinerario día por día y notas.
- **Lechuza** (la lechuza de abajo a la izquierda): tocala para chatear. Te dice qué tenés
  hoy o esta semana, tus próximos turnos, qué trámites te faltan, cómo van tus proyectos,
  tus objetivos de la semana y cuánto falta para tu viaje. Le podés decir
  "anotame una tarea: llamar al banco" y la anota. También sabe todo lo de la plata.
  No es una IA general: entiende preguntas sobre lo que cargás en Nido.
- En **Ajustes** (el engranaje de arriba) le decís a Lechuza cómo llamarte, conectás la
  sincronización y Google Calendar, y tenés tus copias de seguridad.

Todo funciona en tu dispositivo: no usa servicios pagos ni manda tus datos a nadie
(salvo a tu propio GitHub y tu propio Google Calendar, si los conectás).
Son sugerencias para organizarte, no asesoramiento financiero profesional.

## Instalarla en el celu

- **Android (Chrome)**: abrí https://lu-castro.github.io/nido/ → menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**.
- **iPhone (Safari)**: abrí el link → botón compartir → **Agregar a inicio**.

## Sincronizar compu y celu sin perder nada

Los datos se guardan en un Gist secreto de tu cuenta de GitHub. La sincronización **suma**:
junta lo que hay en cada dispositivo y nunca pisa uno con el otro. Solo se borra algo si vos
lo borraste. Además, Nido guarda una copia de seguridad automática por día (y otra antes de
cada operación importante); en **Ajustes → Tus datos** podés volver a ella.

Hacé esto **en cada dispositivo** (compu y celu), entrando a GitHub desde ese dispositivo:

1. Entrá a https://github.com/settings/tokens/new (token "classic").
2. Nombre: `nido compu` (o `nido celu`). Vencimiento: **No expiration**.
   Tildá **solo** el permiso `gist`.
3. Tocá **Generate token** y copiá el código que empieza con `ghp_`.
4. En Nido: **Ajustes → Sincronizar con GitHub**, pegá el token y tocá **Conectar**.

La primera vez que conectás cada dispositivo, Nido también trae lo que tenías en el backup
de Mis Gastos, así se juntan los gastos de la compu y del celu. Si alguna vez falta algo de
Mis Gastos, en **Ajustes → Tus datos** está el botón para volver a traerlo.

Después se sincroniza sola: al cargar algo, al abrir la app y cada minuto mientras está abierta.
Si cargás algo sin internet, se sube cuando vuelve la conexión.
El token queda guardado solo en ese dispositivo. No lo compartas con nadie.

## Turnos sincronizados con Google Calendar

Cuando lo conectás, cada turno médico que cargás en Nido aparece solo en tu Google Calendar,
con avisos 1 día antes y 2 horas antes. Si lo cambiás o borrás en Nido, se cambia o borra
en Calendar; si lo movés o cancelás desde Calendar, Nido se entera. Además, Nido busca en tu
Calendar eventos que parecen turnos médicos (por ejemplo "Turno dentista") y te ofrece sumarlos.

Google pide un "ID de cliente" propio para dejar que una app use tu calendario. Es gratis y
se hace **una sola vez** (unos 10 minutos), desde la compu:

1. Entrá a https://console.cloud.google.com/projectcreate con tu cuenta de Google,
   poné de nombre `Nido` y tocá **Crear**.
2. Con el proyecto Nido elegido arriba, entrá a
   https://console.cloud.google.com/apis/library/calendar-json.googleapis.com y tocá **Habilitar**.
3. Entrá a https://console.cloud.google.com/auth/overview y tocá **Comenzar**:
   - Nombre de la app: `Nido`. Correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Datos de contacto: tu correo. Aceptá y tocá **Crear**.
   - En **Público** (menú de la izquierda) → **Usuarios de prueba** → **Agregar usuarios**:
     poné tu propio correo de Gmail y guardá. (La app queda "en prueba", solo para vos: está bien así.)
4. Entrá a **Clientes** (menú de la izquierda) → **Crear cliente**:
   - Tipo: **Aplicación web**. Nombre: `Nido`.
   - En **Orígenes autorizados de JavaScript** agregá: `https://lu-castro.github.io`
   - Tocá **Crear** y copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`).
5. En Nido: **Ajustes → Google Calendar**, pegá el ID y tocá **Conectar Google Calendar**.
   Se abre una ventana de Google: elegí tu cuenta. Como la app es tuya y está "en prueba",
   Google avisa que no está verificada: tocá **Continuar** y dale permiso al calendario.

El ID de cliente se copia solo al celu con la sincronización; en el celu solo tocás
**Conectar** una vez. Por seguridad, Google pide confirmar cada tanto: cuando pase, en
Turnos aparece el botón **Reconectar** (un toque) y se sincroniza todo lo pendiente.

## Actualizar la app

Si cambiás algún archivo, subilo de nuevo al repo y en `sw.js` subí el número de `nido-v8`
(a `nido-v9`, y así) para que el celu tome la versión nueva.
