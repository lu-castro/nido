# Nido

Tu vida en un solo lugar: plata, trámites, turnos médicos y proyectos. Nace de "Mis Gastos",
que sigue funcionando aparte: la primera vez que abrís Nido en un dispositivo, copia lo que
tenías cargado en Mis Gastos ahí. Desde ese momento, cada app guarda lo suyo por separado.
Es 100% gratis: se publica con GitHub Pages y los datos quedan guardados en tu celu
(con backup opcional en un Gist secreto de GitHub, que sincroniza compu y celu).

## Qué tiene

- **Inicio**: tu agenda de hoy, mañana y la semana (turnos, vencimientos, tareas y fechas
  límite), lo atrasado en rojo, cuánta plata te queda en el mes y accesos rápidos para cargar cosas.
- **Finanzas**: todo lo de antes (gastos, resumen, ingresos y ahorro), con el informe de
  fin de mes y tu plan de mejora.
- **Trámites**: estado (por empezar, en curso, esperando respuesta, listo), organismo,
  vencimiento, turno, N° de expediente y la lista de papeles que necesitás, para ir tildando.
- **Turnos médicos**: especialidad, profesional, fecha y hora, lugar y qué tenés que llevar.
  Los pasados quedan guardados aparte.
- **Proyectos**: cada proyecto con sus tareas, avance y fecha límite. También hay
  "Tareas sueltas" para pendientes que no son de ningún proyecto.
- **Google Calendar**: los turnos, vencimientos, tareas y fechas límite tienen un botón
  "📅 Agregar a Calendar" que abre Google Calendar con el evento ya completado; solo tocás Guardar.
  Los avisos te llegan como cualquier evento de tu calendario.
- **Lechuza** (la lechuza de abajo a la izquierda): tocala para chatear. Te dice qué tenés
  hoy o esta semana, tus próximos turnos, qué trámites te faltan y cómo van tus proyectos.
  Le podés decir "anotame una tarea: llamar al banco" y la anota. También sabe todo lo de
  la plata: cuánto podés gastar hoy, si te alcanza para algo, consejos, o "gasté 5000 en café".
  No es una IA general: entiende preguntas sobre lo que cargás en Nido.
- En **Ajustes** (el engranaje de arriba) le decís a Lechuza cómo llamarte, cambiás tu meta
  de ahorro y conectás la sincronización.

Todo funciona en tu dispositivo: no usa servicios pagos ni manda tus datos a nadie.
Son sugerencias para organizarte, no asesoramiento financiero profesional.

## Publicarla gratis en GitHub Pages

1. Entrá a https://github.com/new, poné de nombre `nido` y creá el repositorio
   (puede ser público; tus gastos NO se suben ahí, quedan en tu celu).
2. En el repo, tocá **Add file → Upload files** y arrastrá todos los archivos de esta carpeta.
   Después **Commit changes**.
3. Andá a **Settings → Pages**. En "Branch" elegí `main` y `/ (root)`, y **Save**.
4. En un minuto la app queda en `https://TU-USUARIO.github.io/nido/`.

## Instalarla en el celu

- **Android (Chrome)**: abrí el link → menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**.
- **iPhone (Safari)**: abrí el link → botón compartir → **Agregar a inicio**.

## Sincronizar compu y celu (gratis, con GitHub)

Lo que cargues en un dispositivo aparece en el otro, y no perdés nada si cambiás de celu.
Los datos se guardan en un Gist secreto de tu cuenta de GitHub.

Hacé esto **en cada dispositivo** (compu y celu), entrando a GitHub desde ese dispositivo:

1. Entrá a https://github.com/settings/tokens/new (token "classic").
2. Nombre: `nido compu` (o `nido celu`). Vencimiento: **No expiration**.
   Tildá **solo** el permiso `gist`.
3. Tocá **Generate token** y copiá el código que empieza con `ghp_`.
4. En la app: **Ajustes → Sincronizar con GitHub**, pegá el token y tocá **Conectar**.

El primer dispositivo crea el backup; el segundo lo encuentra solo y junta los datos de los dos.
Después se sincroniza sola: al cargar algo, al abrir la app y cada minuto mientras está abierta.
Si cargás algo sin internet, se sube cuando vuelve la conexión.

El token queda guardado solo en ese dispositivo. No lo compartas con nadie.

## Actualizar la app

Si cambiás algún archivo, subilo de nuevo al repo y en `sw.js` subí el número de `nido-v7`
(a `nido-v8`, y así) para que el celu tome la versión nueva.
