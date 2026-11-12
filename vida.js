'use strict';
// Nido: Inicio, trámites, turnos médicos, proyectos y el botón de Google Calendar.
// Usa funciones de app.js (data, save, openSheet, esc…), asesor.js y chat.js.

const ESTADOS_TRAMITE = { pendiente: 'Por empezar', curso: 'En curso', esperando: 'Esperando respuesta', listo: 'Listo' };
const ESTADOS_PROYECTO = { activo: 'Activo', pausado: 'En pausa', terminado: 'Terminado' };
const ESPECIALIDADES = ['Clínica', 'Ginecología', 'Odontología', 'Dermatología', 'Oftalmología', 'Psicología',
  'Nutrición', 'Cardiología', 'Traumatología', 'Kinesiología', 'Análisis de sangre', 'Ecografía'];
const EMOJIS = ['🎯', '💼', '🏠', '✈️', '📚', '💪', '🎨', '💻', '🌱', '🎉', '🧾', '❤️'];

let filtroTramites = 'activos';

// ---------- Fechas ----------
function isoToDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function diasHasta(iso) { return Math.round((isoToDate(iso) - isoToDate(todayISO())) / 864e5); }
function fechaCorta(iso) { return isoToDate(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }); }
function cuando(iso) {
  const n = diasHasta(iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n > 1 && n < 7) return cap(isoToDate(iso).toLocaleDateString('es-AR', { weekday: 'long' }));
  if (n < 0 && n > -15) return 'Hace ' + (-n) + ' días';
  return fechaCorta(iso);
}
function saludoHora() {
  const h = new Date().getHours(), n = (cfg().nombre || '').trim();
  const base = h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return '¡' + base + (n ? ', ' + esc(n) : '') + '!';
}

// ---------- Listas de cosas para llevar / papeles ----------
function docsDeTexto(txt, prev = []) {
  return String(txt || '').split('\n').map(s => s.trim()).filter(Boolean)
    .map(t => ({ t, ok: !!(prev.find(d => d.t === t) || {}).ok }));
}
const docsTexto = docs => (docs || []).map(d => d.t).join('\n');
function checklistHTML(kind, id, docs) {
  if (!docs || !docs.length) return '';
  const hechos = docs.filter(d => d.ok).length;
  return `<div class="checklist"><div class="vcard-s">${hechos} de ${docs.length} listos</div>${docs.map((d, i) =>
    `<button type="button" class="chk${d.ok ? ' ok' : ''}" data-chk="${kind}:${id}:${i}"><span class="box">${d.ok ? '✓' : ''}</span><span>${esc(d.t)}</span></button>`).join('')}</div>`;
}

// ---------- Google Calendar ----------
// Arma el link de "crear evento" de Google Calendar: se abre con todo completado y solo tocás Guardar.
function gcalUrl({ titulo, fecha, hora, minutos = 60, detalles = '', lugar = '', hasta = '' }) {
  const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titulo });
  const ini = isoToDate(fecha);
  if (hora) {
    const [h, m] = hora.split(':').map(Number);
    ini.setHours(h, m || 0);
    const fin = new Date(ini.getTime() + minutos * 60000);
    const hms = d => 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
    p.set('dates', ymd(ini) + hms(ini) + '/' + ymd(fin) + hms(fin));
    try { p.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { /* ignore */ }
  } else {
    const fin = hasta && hasta > fecha ? isoToDate(hasta) : new Date(ini); fin.setDate(fin.getDate() + 1);
    p.set('dates', ymd(ini) + '/' + ymd(fin));
  }
  p.set('details', (detalles ? detalles + '\n\n' : '') + 'Cargado desde Nido');
  if (lugar) p.set('location', lugar);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

const listaDe = k => ({ turno: data.turnos, tramite: data.tramites, tarea: data.tareas, proyecto: data.proyectos,
  plan: data.planes, objetivo: data.objetivos, viaje: data.viajes, gcalBorrar: data.gcalBorrar }[k]);
const buscar = (k, id) => (listaDe(k) || []).find(x => x.id === id);
const llevar = docs => (docs && docs.length ? 'Llevar: ' + docs.map(d => d.t).join(', ') : '');

// Cada botón de calendario tiene una clave "tipo:id". Devuelve el evento a crear y dónde marcar que ya está.
function eventoDe(clave) {
  const [tipo, id] = clave.split(':');
  if (tipo === 'turno') {
    const t = buscar('turno', id); if (!t || !t.fecha) return null;
    return { item: t, campo: 'gcal', ev: { titulo: '🩺 ' + (t.especialidad || 'Turno médico') + (t.profesional ? ' con ' + t.profesional : ''),
      fecha: t.fecha, hora: t.hora, lugar: t.lugar, detalles: [t.nota, llevar(t.docs)].filter(Boolean).join('\n') } };
  }
  if (tipo === 'tramiteTurno' || tipo === 'tramiteVence') {
    const x = buscar('tramite', id); if (!x) return null;
    const det = [x.organismo, x.expediente ? 'N° ' + x.expediente : '', llevar(x.docs), x.nota].filter(Boolean).join('\n');
    if (tipo === 'tramiteTurno') return x.turnoFecha ? { item: x, campo: 'gcalTurno', ev: { titulo: '📋 ' + x.titulo, fecha: x.turnoFecha, hora: x.turnoHora, lugar: x.organismo, detalles: det } } : null;
    return x.vence ? { item: x, campo: 'gcalVence', ev: { titulo: '⏰ Vence: ' + x.titulo, fecha: x.vence, detalles: det } } : null;
  }
  if (tipo === 'tarea') {
    const t = buscar('tarea', id); if (!t || !t.fecha) return null;
    const p = buscar('proyecto', t.proyectoId);
    return { item: t, campo: 'gcal', ev: { titulo: '✅ ' + t.texto, fecha: t.fecha, detalles: p ? 'Proyecto: ' + p.nombre : '' } };
  }
  if (tipo === 'plan') {
    const p = buscar('plan', id); if (!p || !p.fecha) return null;
    return { item: p, campo: 'gcal', ev: { titulo: '🗓️ ' + p.texto, fecha: p.fecha, hora: p.hora } };
  }
  if (tipo === 'viaje') {
    const v = buscar('viaje', id); if (!v || !v.desde) return null;
    return { item: v, campo: 'gcal', ev: { titulo: (v.emoji || '✈️') + ' Viaje a ' + v.destino, fecha: v.desde, hasta: v.hasta, detalles: v.notas || '' } };
  }
  if (tipo === 'proyecto') {
    const p = buscar('proyecto', id); if (!p || !p.limite) return null;
    return { item: p, campo: 'gcal', ev: { titulo: (p.emoji || '🎯') + ' Fecha límite: ' + p.nombre, fecha: p.limite, detalles: p.descripcion || '' } };
  }
  return null;
}
function gcalBtn(clave, hecho, texto = 'Agregar a Calendar') {
  return `<button type="button" class="gcal${hecho ? ' hecho' : ''}" data-gcal="${clave}">📅 ${hecho ? 'En Calendar ✓' : esc(texto)}</button>`;
}
function abrirCalendario(clave) {
  const e = eventoDe(clave);
  if (!e) return toast('Primero poné una fecha');
  window.open(gcalUrl(e.ev), '_blank', 'noopener');
  e.item[e.campo] = true; e.item.mod = Date.now();
  ocultarSnack(); save();
}

// Después de guardar algo con fecha, ofrece agregarlo a Google Calendar
let snackTimer;
function ofrecerCalendario(clave, texto) {
  const s = $('#snack');
  s.innerHTML = `<span>${esc(texto)}</span>${gcalBtn(clave, false, 'Agregar')}<button type="button" class="snack-x" aria-label="Cerrar">✕</button>`;
  s.hidden = false; $('#toast').hidden = true;
  s.querySelector('.snack-x').onclick = ocultarSnack;
  clearTimeout(snackTimer); snackTimer = setTimeout(ocultarSnack, 10000);
}
function ocultarSnack() { const s = $('#snack'); if (s) s.hidden = true; }

// ---------- Agenda: todo lo que tiene fecha ----------
function nombreProyecto(id) { const p = buscar('proyecto', id); return p ? (p.emoji || '🎯') + ' ' + p.nombre : 'Tarea'; }
function agenda() {
  const out = [];
  for (const t of data.turnos) {
    if (t.estado === 'cancelado' || !t.fecha) continue;
    out.push({ fecha: t.fecha, hora: t.hora, ico: '🩺', titulo: t.especialidad || 'Turno médico', tipo: 'turno', ref: 'turno:' + t.id,
      sub: [t.profesional, t.lugar].filter(Boolean).join(' · ') || 'Turno médico', docsFaltan: (t.docs || []).filter(d => !d.ok).length });
  }
  for (const x of data.tramites) {
    if (x.estado === 'listo') continue;
    if (x.turnoFecha) out.push({ fecha: x.turnoFecha, hora: x.turnoHora, ico: '📋', titulo: x.titulo, tipo: 'tramiteTurno', ref: 'tramite:' + x.id,
      sub: 'Turno del trámite' + (x.organismo ? ' · ' + x.organismo : ''), docsFaltan: (x.docs || []).filter(d => !d.ok).length });
    if (x.vence) out.push({ fecha: x.vence, ico: '⏰', titulo: x.titulo, tipo: 'vence', ref: 'tramite:' + x.id, atrasable: true, sub: 'Vence el trámite' });
  }
  for (const t of data.tareas) {
    if (!t.hecha && t.fecha) out.push({ fecha: t.fecha, ico: '✅', titulo: t.texto, tipo: 'tarea', ref: 'tarea:' + t.id, atrasable: true, sub: nombreProyecto(t.proyectoId), id: t.id });
  }
  for (const p of data.proyectos) {
    if (p.estado === 'activo' && p.limite) out.push({ fecha: p.limite, ico: p.emoji || '🎯', titulo: p.nombre, tipo: 'proyecto', ref: 'proyecto:' + p.id, atrasable: true, sub: 'Fecha límite del proyecto' });
  }
  for (const p of data.planes) {
    if (!p.hecho && p.fecha) out.push({ fecha: p.fecha, hora: p.hora, ico: '🗓️', titulo: p.texto, tipo: 'plan', ref: 'plan:' + p.id, sub: 'Plan de tu semana' });
  }
  for (const v of data.viajes) {
    if (v.desde && v.destino) out.push({ fecha: v.desde, ico: v.emoji || '✈️', titulo: 'Viaje a ' + v.destino, tipo: 'viaje', ref: 'viaje:' + v.id,
      sub: v.hasta ? 'Hasta el ' + fechaCorta(v.hasta) : 'Vacaciones' });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '99').localeCompare(b.hora || '99'));
}
function agendaAgrupada() {
  const hoy = todayISO(), ag = agenda();
  return {
    atrasado: ag.filter(e => e.atrasable && e.fecha < hoy),
    hoy: ag.filter(e => e.fecha === hoy),
    manana: ag.filter(e => diasHasta(e.fecha) === 1),
    semana: ag.filter(e => { const n = diasHasta(e.fecha); return n >= 2 && n <= 7; }),
    despues: ag.filter(e => { const n = diasHasta(e.fecha); return n >= 8 && n <= 31; }).slice(0, 4),
  };
}
const listaCorta = evs => evs.slice(0, 4).map(e => `• ${e.ico} <b>${esc(e.titulo)}</b>${e.hora ? ' a las ' + esc(e.hora) : ''}`).join('<br>') +
  (evs.length > 4 ? `<br>… y ${evs.length - 4} más` : '');

// Lo que Lechuza te cuenta de tu agenda (va antes de lo de la plata)
function mensajesVida() {
  const g = agendaAgrupada(), msgs = [];
  if (g.atrasado.length) {
    msgs.push({ mood: 'alerta', texto: `Tenés ${g.atrasado.length === 1 ? 'algo atrasado' : g.atrasado.length + ' cosas atrasadas'}:<br>${listaCorta(g.atrasado)}`,
      accion: { label: 'Ver en Inicio', fn: () => setView('inicio') } });
  }
  if (g.hoy.length) msgs.push({ mood: 'atento', texto: `Hoy tenés:<br>${listaCorta(g.hoy)}` });
  if (g.manana.length) {
    const llevarAlgo = g.manana.some(e => e.docsFaltan);
    msgs.push({ mood: 'pensando', texto: `Mañana:<br>${listaCorta(g.manana)}${llevarAlgo ? '<br>Tenés cosas para llevar sin tildar: preparalas hoy así no corrés 😉' : ''}` });
  }
  const vencePronto = g.semana.filter(e => e.tipo === 'vence' && diasHasta(e.fecha) <= 5);
  for (const e of vencePronto.slice(0, 2)) {
    msgs.push({ mood: 'atento', texto: `El trámite <b>${esc(e.titulo)}</b> vence en ${diasHasta(e.fecha)} días (${fechaCorta(e.fecha)}). ¿Lo encaramos?`,
      accion: { label: 'Ver trámite', fn: () => abrirRef(e.ref) } });
  }
  return msgs.slice(0, 3);
}

// ---------- Abrir un elemento desde la agenda o el chat ----------
function abrirRef(ref) {
  const [k, id] = ref.split(':');
  const it = buscar(k, id); if (!it) return;
  ({ turno: turnoSheet, tramite: tramiteSheet, tarea: tareaSheet, proyecto: proyectoSheet, plan: planSheet, viaje: abrirViaje })[k](it);
}

function guardarEn(lista, item) {
  const i = lista.findIndex(x => x.id === item.id);
  if (i >= 0) lista[i] = item; else lista.push(item);
}
function borrarDe(k, id) {
  const l = listaDe(k), i = l.findIndex(x => x.id === id);
  if (i >= 0) l.splice(i, 1);
  markDeleted(id);
}
function sel(id, opciones, actual) {
  return `<select id="${id}">${Object.entries(opciones).map(([v, t]) => `<option value="${v}"${v === actual ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
}

// ---------- Hojas para cargar / editar ----------
function tramiteSheet(x) {
  const isNew = !x;
  x = x || { titulo: '', organismo: '', estado: 'pendiente', vence: '', turnoFecha: '', turnoHora: '', expediente: '', docs: [], nota: '' };
  openSheet({
    title: isNew ? 'Nuevo trámite' : 'Editar trámite',
    focus: isNew ? '#tTitulo' : null,
    body: `
      <label class="label" for="tTitulo">Qué trámite</label>
      <input id="tTitulo" type="text" placeholder="Ej: Renovar DNI, licencia de conducir, monotributo" value="${esc(x.titulo)}">
      <label class="label" for="tOrg">Dónde / organismo</label>
      <input id="tOrg" type="text" placeholder="Ej: RENAPER, ANSES, ARCA, Municipalidad" value="${esc(x.organismo)}">
      <label class="label" for="tEstado">Estado</label>${sel('tEstado', ESTADOS_TRAMITE, x.estado)}
      <label class="label" for="tVence">Fecha límite o vencimiento (opcional)</label>
      <input id="tVence" type="date" value="${esc(x.vence)}">
      <span class="label">Turno para hacerlo (opcional)</span>
      <div class="row2"><input id="tTFecha" type="date" value="${esc(x.turnoFecha)}" aria-label="Fecha del turno"><input id="tTHora" type="time" value="${esc(x.turnoHora)}" aria-label="Hora del turno"></div>
      <label class="label" for="tExp">N° de trámite o expediente</label>
      <input id="tExp" type="text" placeholder="Opcional" value="${esc(x.expediente)}">
      <label class="label" for="tDocs">Qué necesitás (uno por renglón)</label>
      <textarea id="tDocs" class="campo" rows="3" placeholder="DNI&#10;Foto 4x4&#10;Comprobante de pago">${esc(docsTexto(x.docs))}</textarea>
      <label class="label" for="tNota">Nota</label>
      <textarea id="tNota" class="campo" rows="2" placeholder="Ej: preguntar por la tasa, llevar copia">${esc(x.nota)}</textarea>
      ${!isNew ? `<div class="vcard-pie">${x.turnoFecha ? gcalBtn('tramiteTurno:' + x.id, x.gcalTurno, 'Turno a Calendar') : ''}${x.vence ? gcalBtn('tramiteVence:' + x.id, x.gcalVence, 'Vencimiento a Calendar') : ''}</div>` : ''}`,
    onSubmit() {
      const titulo = $('#tTitulo').value.trim();
      if (!titulo) return toast('Poné qué trámite es');
      const item = { ...x, id: x.id || uid(), creado: x.creado || Date.now(), mod: Date.now(), titulo,
        organismo: $('#tOrg').value.trim(), estado: $('#tEstado').value, vence: $('#tVence').value,
        turnoFecha: $('#tTFecha').value, turnoHora: $('#tTHora').value, expediente: $('#tExp').value.trim(),
        docs: docsDeTexto($('#tDocs').value, x.docs), nota: $('#tNota').value.trim() };
      if (item.turnoFecha !== x.turnoFecha || item.turnoHora !== x.turnoHora) item.gcalTurno = false;
      if (item.vence !== x.vence) item.gcalVence = false;
      const recienListo = item.estado === 'listo' && x.estado !== 'listo';
      guardarEn(data.tramites, item); closeSheet(); save();
      if (recienListo) toast('¡Un trámite menos! 🎉');
      else if (item.turnoFecha && !item.gcalTurno) ofrecerCalendario('tramiteTurno:' + item.id, 'Trámite guardado. ¿Lo sumás a Calendar?');
      else if (item.vence && !item.gcalVence) ofrecerCalendario('tramiteVence:' + item.id, 'Trámite guardado. ¿Agendás el vencimiento?');
      else toast(isNew ? 'Trámite guardado' : 'Trámite actualizado');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('¿Borrar este trámite?')) return;
      borrarDe('tramite', x.id); closeSheet(); save(); toast('Trámite borrado');
    },
  });
}

function turnoSheet(t) {
  const isNew = !t;
  t = t || { especialidad: '', profesional: '', fecha: '', hora: '', lugar: '', docs: [], nota: '', estado: 'pendiente' };
  openSheet({
    title: isNew ? 'Nuevo turno médico' : 'Editar turno',
    focus: isNew ? '#mEsp' : null,
    body: `
      <label class="label" for="mEsp">Especialidad o estudio</label>
      <input id="mEsp" type="text" list="especialidades" placeholder="Ej: Odontología, análisis de sangre" value="${esc(t.especialidad)}">
      <datalist id="especialidades">${ESPECIALIDADES.map(e => `<option value="${esc(e)}">`).join('')}</datalist>
      <label class="label" for="mProf">Profesional</label>
      <input id="mProf" type="text" placeholder="Ej: Dra. Pérez" value="${esc(t.profesional)}">
      <span class="label">Fecha y hora</span>
      <div class="row2"><input id="mFecha" type="date" value="${esc(t.fecha)}" aria-label="Fecha"><input id="mHora" type="time" value="${esc(t.hora)}" aria-label="Hora"></div>
      <label class="label" for="mLugar">Lugar</label>
      <input id="mLugar" type="text" placeholder="Ej: Sanatorio, dirección, consultorio online" value="${esc(t.lugar)}">
      <label class="label" for="mDocs">Qué llevar (uno por renglón)</label>
      <textarea id="mDocs" class="campo" rows="3" placeholder="Credencial de la prepaga&#10;Orden médica&#10;Estudios anteriores">${esc(docsTexto(t.docs))}</textarea>
      <label class="label" for="mNota">Nota</label>
      <textarea id="mNota" class="campo" rows="2" placeholder="Ej: ir en ayunas, pedir receta">${esc(t.nota)}</textarea>
      <label class="check"><input id="mCancel" type="checkbox" ${t.estado === 'cancelado' ? 'checked' : ''}> Se canceló</label>
      ${!isNew && t.fecha ? `<div class="vcard-pie">${turnoCalHTML(t)}</div>` : ''}`,
    onSubmit() {
      const fecha = $('#mFecha').value;
      if (!fecha) return toast('Poné la fecha del turno');
      const item = { ...t, id: t.id || uid(), creado: t.creado || Date.now(), mod: Date.now(),
        especialidad: $('#mEsp').value.trim(), profesional: $('#mProf').value.trim(), fecha, hora: $('#mHora').value,
        lugar: $('#mLugar').value.trim(), docs: docsDeTexto($('#mDocs').value, t.docs), nota: $('#mNota').value.trim(),
        estado: $('#mCancel').checked ? 'cancelado' : 'pendiente' };
      if (item.fecha !== t.fecha || item.hora !== t.hora) item.gcal = false;
      guardarEn(data.turnos, item); closeSheet(); save();
      if (googleActivo()) toast((isNew ? 'Turno guardado' : 'Turno actualizado') + (item.estado === 'cancelado' ? '' : ' · se sincroniza con tu Calendar'));
      else if (item.estado !== 'cancelado' && !item.gcal && fecha >= todayISO()) ofrecerCalendario('turno:' + item.id, 'Turno guardado. ¿Lo sumás a Calendar?');
      else toast(isNew ? 'Turno guardado' : 'Turno actualizado');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('¿Borrar este turno?' + (t.gEventId ? ' También se borra de tu Google Calendar.' : ''))) return;
      if (t.gEventId) data.gcalBorrar.push({ id: t.gEventId, mod: Date.now() });
      borrarDe('turno', t.id); closeSheet(); save(); toast('Turno borrado');
    },
  });
}

function proyectoSheet(p) {
  const isNew = !p;
  p = p || { nombre: '', emoji: '🎯', descripcion: '', estado: 'activo', limite: '' };
  openSheet({
    title: isNew ? 'Nuevo proyecto' : 'Editar proyecto',
    focus: isNew ? '#pNombre' : null,
    body: `
      <div class="chips" id="emojiChips">${EMOJIS.map(e => `<button type="button" class="chip emoji${e === p.emoji ? ' on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
      <label class="label" for="pNombre">Nombre</label>
      <input id="pNombre" type="text" placeholder="Ej: Mudanza, curso de inglés, web nueva" value="${esc(p.nombre)}">
      <label class="label" for="pDesc">De qué se trata (opcional)</label>
      <textarea id="pDesc" class="campo" rows="2">${esc(p.descripcion)}</textarea>
      <label class="label" for="pEstado">Estado</label>${sel('pEstado', ESTADOS_PROYECTO, p.estado)}
      <label class="label" for="pLimite">Fecha límite (opcional)</label>
      <input id="pLimite" type="date" value="${esc(p.limite)}">
      ${!isNew && p.limite ? `<div class="vcard-pie">${gcalBtn('proyecto:' + p.id, p.gcal)}</div>` : ''}`,
    onSubmit() {
      const nombre = $('#pNombre').value.trim();
      if (!nombre) return toast('Ponele un nombre');
      const on = document.querySelector('#emojiChips .chip.on');
      const item = { ...p, id: p.id || uid(), creado: p.creado || Date.now(), mod: Date.now(), nombre,
        emoji: on ? on.dataset.emoji : '🎯', descripcion: $('#pDesc').value.trim(), estado: $('#pEstado').value, limite: $('#pLimite').value };
      if (item.limite !== p.limite) item.gcal = false;
      guardarEn(data.proyectos, item); closeSheet();
      if (view !== 'proyectos') setView('proyectos');
      save();
      if (item.limite && !item.gcal) ofrecerCalendario('proyecto:' + item.id, 'Proyecto guardado. ¿Agendás la fecha límite?');
      else toast(isNew ? 'Proyecto creado: sumale tareas' : 'Proyecto actualizado');
    },
    onDelete: isNew ? null : () => {
      const n = data.tareas.filter(t => t.proyectoId === p.id).length;
      if (!confirm(`¿Borrar el proyecto "${p.nombre}"${n ? ` y sus ${n} tareas` : ''}?`)) return;
      for (const t of data.tareas.filter(t => t.proyectoId === p.id)) borrarDe('tarea', t.id);
      borrarDe('proyecto', p.id); closeSheet(); save(); toast('Proyecto borrado');
    },
  });
  $('#emojiChips').onclick = e => {
    const c = e.target.closest('[data-emoji]'); if (!c) return;
    document.querySelectorAll('#emojiChips .chip').forEach(x => x.classList.toggle('on', x === c));
  };
}

function tareaSheet(t, proyectoId = '') {
  const isNew = !t;
  t = t || { texto: '', proyectoId, fecha: '', hecha: false };
  const opciones = { '': 'Sin proyecto (tarea suelta)' };
  for (const p of data.proyectos.filter(p => p.estado !== 'terminado' || p.id === t.proyectoId)) opciones[p.id] = (p.emoji || '🎯') + ' ' + p.nombre;
  openSheet({
    title: isNew ? 'Nueva tarea' : 'Editar tarea',
    focus: isNew ? '#kTexto' : null,
    body: `
      <label class="label" for="kTexto">Qué hay que hacer</label>
      <input id="kTexto" type="text" placeholder="Ej: llamar al banco, comprar cajas" value="${esc(t.texto)}">
      <label class="label" for="kProy">Proyecto</label>${sel('kProy', opciones, t.proyectoId || '')}
      <label class="label" for="kFecha">Para cuándo (opcional)</label>
      <input id="kFecha" type="date" value="${esc(t.fecha)}">
      <label class="check"><input id="kHecha" type="checkbox" ${t.hecha ? 'checked' : ''}> Ya está hecha</label>
      ${!isNew && t.fecha ? `<div class="vcard-pie">${gcalBtn('tarea:' + t.id, t.gcal)}</div>` : ''}`,
    onSubmit() {
      const texto = $('#kTexto').value.trim();
      if (!texto) return toast('Escribí la tarea');
      const item = { ...t, id: t.id || uid(), creado: t.creado || Date.now(), mod: Date.now(), texto,
        proyectoId: $('#kProy').value, fecha: $('#kFecha').value, hecha: $('#kHecha').checked };
      if (item.fecha !== t.fecha) item.gcal = false;
      guardarEn(data.tareas, item); closeSheet(); save();
      if (isNew && item.fecha && !item.hecha) ofrecerCalendario('tarea:' + item.id, 'Tarea guardada. ¿La sumás a Calendar?');
      else toast(isNew ? 'Tarea guardada' : 'Tarea actualizada');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('¿Borrar esta tarea?')) return;
      borrarDe('tarea', t.id); closeSheet(); save(); toast('Tarea borrada');
    },
  });
}

function nuevaTareaRapida(texto, proyectoId = '') {
  const item = { id: uid(), creado: Date.now(), mod: Date.now(), texto, proyectoId, fecha: '', hecha: false };
  data.tareas.push(item); save();
  return item;
}
function toggleTarea(id) {
  const t = buscar('tarea', id); if (!t) return;
  t.hecha = !t.hecha; t.mod = Date.now();
  if (t.hecha) {
    const p = buscar('proyecto', t.proyectoId);
    const resto = p ? data.tareas.filter(x => x.proyectoId === p.id && !x.hecha).length : 1;
    toast(p && !resto ? `¡Terminaste todas las tareas de ${p.nombre}! 🎉` : '¡Hecho! ✓');
  }
  save();
}

function menuNuevo() {
  openSheet({
    title: '¿Qué querés agregar?', sinBotones: true,
    body: `<div class="opciones">
      <button type="button" data-nuevo="gasto"><span>💸</span>Gasto</button>
      <button type="button" data-nuevo="turno"><span>🩺</span>Turno médico</button>
      <button type="button" data-nuevo="tramite"><span>📋</span>Trámite</button>
      <button type="button" data-nuevo="tarea"><span>✅</span>Tarea</button>
      <button type="button" data-nuevo="proyecto"><span>🎯</span>Proyecto</button>
      <button type="button" data-nuevo="plan"><span>🗓️</span>Plan de la semana</button>
      <button type="button" data-nuevo="viaje"><span>🏖️</span>Viaje</button>
      <button type="button" data-nuevo="cerrar" class="ancho2"><span>✕</span>Cancelar</button>
    </div>`,
  });
}
function nuevo(tipo) {
  closeSheet();
  if (tipo === 'gasto') { current = monthKey(new Date()); gastoSheet(); }
  if (tipo === 'turno') turnoSheet();
  if (tipo === 'tramite') tramiteSheet();
  if (tipo === 'tarea') tareaSheet();
  if (tipo === 'proyecto') proyectoSheet();
  if (tipo === 'plan') planSheet(null, todayISO());
  if (tipo === 'viaje') viajeSheet();
}

// ---------- Pantallas ----------
function agItemHTML(e, mostrarFecha) {
  const lado = e.hora ? esc(e.hora) : '';
  const fecha = mostrarFecha ? cuando(e.fecha) : '';
  return `<div class="ag-item" data-abrir="${e.ref}">
    ${e.tipo === 'tarea' ? `<button type="button" class="tcheck" data-ttoggle="${e.id}" aria-label="Marcar como hecha">✓</button>` : `<span class="ag-ico">${e.ico}</span>`}
    <span class="mid"><b>${esc(e.titulo)}</b><small>${esc(e.sub)}${e.docsFaltan ? ` · 🎒 ${e.docsFaltan} para llevar` : ''}</small></span>
    <span class="ag-cuando">${[fecha, lado].filter(Boolean).join(' · ')}</span>
  </div>`;
}

function renderInicio() {
  const g = agendaAgrupada();
  const grupos = [['atrasado', 'Atrasado', true], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Esta semana'], ['despues', 'Más adelante']];
  const agendaHTML = grupos.filter(([k]) => g[k].length).map(([k, titulo, rojo]) =>
    `<div class="ag-grupo${rojo ? ' rojo' : ''}">${titulo}</div>${g[k].map(e => agItemHTML(e, k === 'atrasado' || k === 'semana' || k === 'despues')).join('')}`).join('');

  const msj = mensajesVida()[0] || mensajesAlAbrir()[0] || { mood: 'feliz', texto: 'Todo tranqui por acá. Si querés, preguntame algo 🦉' };
  const texto = msj.texto.replace(/^¡(Buen día|Buenas tardes|Buenas noches)! /, '');

  // Plata del mes
  const t = totals(monthKey(new Date()));
  let plata = '<span class="muted">Cargá tus ingresos del mes para ver cuánto te queda.</span>';
  if (t.ingresosARS) {
    const p = proyeccion();
    plata = `<div class="sum-grid"><div><span class="label">Te queda este mes</span><b class="${t.restante < 0 ? 'neg' : ''}">${money(t.restante)}</b></div>
      <div><span class="label">Podés gastar x día</span><b>${money(Math.max(p.presupuestoDia, 0))}</b></div></div>`;
  }

  const activos = data.tramites.filter(x => x.estado !== 'listo');
  const vencenPronto = activos.filter(x => x.vence && diasHasta(x.vence) <= 7).length;
  const prox = data.turnos.filter(x => x.estado !== 'cancelado' && x.fecha >= todayISO()).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))[0];
  const proys = data.proyectos.filter(p => p.estado === 'activo');
  const tareasP = data.tareas.filter(x => !x.hecha).length;

  $('#inicioBody').innerHTML = `
    <div class="hola"><h2>${saludoHora()}</h2><p>${esc(cap(new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })))}</p></div>
    <div class="card lechuza-card" id="inicioLechuza">
      <div class="buho mini" data-mood="${msj.mood || 'feliz'}">${BUHO_SVG}</div>
      <div><p>${texto}</p><span class="link">Hablar con ${ASESOR_NOMBRE} →</span></div>
    </div>
    <div class="quick">
      <button type="button" data-nuevo="gasto"><span>💸</span>Gasto</button>
      <button type="button" data-nuevo="turno"><span>🩺</span>Turno</button>
      <button type="button" data-nuevo="tramite"><span>📋</span>Trámite</button>
      <button type="button" data-nuevo="tarea"><span>✅</span>Tarea</button>
    </div>
    <div class="card"><h2>Tu agenda</h2>${agendaHTML || '<p class="muted">No tenés nada con fecha en los próximos días. 🌿<br>Cuando cargues turnos, trámites o tareas con fecha, aparecen acá.</p>'}</div>
    <div class="card fin-mini" data-ir="gastos"><h2>💰 Tu plata en ${esc(mesCorto(monthKey(new Date())).toLowerCase())}</h2>${plata}</div>
    <div class="stats">
      <div class="card stat" data-ir="tramites"><span>📋 Trámites</span><b>${activos.length}</b><span>${activos.length ? (vencenPronto ? `${vencenPronto} vence${vencenPronto > 1 ? 'n' : ''} pronto` : 'en curso') : 'nada pendiente'}</span></div>
      <div class="card stat" data-ir="turnos"><span>🩺 Próximo turno</span><b>${prox ? esc(cuando(prox.fecha)) : '—'}</b><span>${prox ? esc(prox.especialidad || 'Turno médico') : 'sin turnos'}</span></div>
      <div class="card stat" data-ir="proyectos"><span>🎯 Proyectos</span><b>${proys.length}</b><span>${tareasP} tarea${tareasP === 1 ? '' : 's'} pendiente${tareasP === 1 ? '' : 's'}</span></div>
      ${statViaje()}
    </div>`;
}

function proximaFechaTramite(x) {
  return [x.turnoFecha, x.vence].filter(Boolean).sort()[0] || '9999';
}
function renderTramites() {
  const activos = data.tramites.filter(x => x.estado !== 'listo').sort((a, b) => proximaFechaTramite(a).localeCompare(proximaFechaTramite(b)));
  const listos = data.tramites.filter(x => x.estado === 'listo').sort((a, b) => b.mod - a.mod);
  const lista = filtroTramites === 'listos' ? listos : activos;
  const card = x => {
    const tags = [];
    if (x.turnoFecha) tags.push(`<span class="tag">🗓 Turno: ${esc(cuando(x.turnoFecha))}${x.turnoHora ? ' ' + esc(x.turnoHora) : ''}</span>`);
    if (x.vence) {
      const n = diasHasta(x.vence);
      const cls = x.estado === 'listo' ? '' : n < 0 ? ' rojo' : n <= 7 ? ' naranja' : '';
      tags.push(`<span class="tag${cls}">⏰ ${n < 0 && x.estado !== 'listo' ? 'Venció' : 'Vence'} ${esc(cuando(x.vence).toLowerCase())}</span>`);
    }
    const cal = x.estado === 'listo' ? '' : (x.turnoFecha ? gcalBtn('tramiteTurno:' + x.id, x.gcalTurno, 'Turno a Calendar') : '') + (x.vence ? gcalBtn('tramiteVence:' + x.id, x.gcalVence, 'Vencimiento a Calendar') : '');
    return `<div class="vcard" data-abrir="tramite:${x.id}">
      <div class="vcard-h"><b>${esc(x.titulo)}</b><span class="estado est-${x.estado}">${ESTADOS_TRAMITE[x.estado] || ''}</span></div>
      ${x.organismo || x.expediente ? `<div class="vcard-s">${esc([x.organismo, x.expediente ? 'N° ' + x.expediente : ''].filter(Boolean).join(' · '))}</div>` : ''}
      ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
      ${checklistHTML('tramite', x.id, x.docs)}
      ${x.nota ? `<div class="vcard-s nota">📝 ${esc(x.nota)}</div>` : ''}
      ${cal ? `<div class="vcard-pie">${cal}</div>` : ''}
    </div>`;
  };
  $('#tramitesBody').innerHTML = `
    <div class="chips filtros">
      <button type="button" class="chip${filtroTramites === 'activos' ? ' on' : ''}" data-filtro="activos">Pendientes (${activos.length})</button>
      <button type="button" class="chip${filtroTramites === 'listos' ? ' on' : ''}" data-filtro="listos">Listos (${listos.length})</button>
    </div>
    ${lista.length ? lista.map(card).join('') : `<div class="empty">${filtroTramites === 'listos' ? 'Todavía no terminaste ningún trámite.' : 'No tenés trámites pendientes.<br>Tocá <b>+</b> para agregar uno: DNI, licencia, monotributo, obra social…'}</div>`}`;
}

function renderTurnos() {
  const hoy = todayISO();
  const orden = (a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''));
  const prox = data.turnos.filter(t => t.estado !== 'cancelado' && t.fecha >= hoy).sort(orden);
  const pasados = data.turnos.filter(t => t.estado === 'cancelado' || t.fecha < hoy).sort(orden).reverse().slice(0, 30);
  const card = (t, pasado) => {
    const d = isoToDate(t.fecha);
    return `<div class="vcard turno${pasado ? ' pasado' : ''}" data-abrir="turno:${t.id}">
      <div class="fecha-bloque"><b>${d.getDate()}</b><span>${d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span></div>
      <div class="grow">
        <div class="vcard-h"><b>${esc(t.especialidad || 'Turno médico')}</b>${t.estado === 'cancelado' ? '<span class="estado">Cancelado</span>' : ''}</div>
        <div class="vcard-s">${esc([cuando(t.fecha) + (t.hora ? ' · ' + t.hora + ' h' : ''), t.profesional].filter(Boolean).join(' · '))}</div>
        ${t.lugar ? `<div class="vcard-s">📍 ${esc(t.lugar)}</div>` : ''}
        ${!pasado ? checklistHTML('turno', t.id, t.docs) : ''}
        ${t.nota && !pasado ? `<div class="vcard-s nota">📝 ${esc(t.nota)}</div>` : ''}
        ${!pasado ? `<div class="vcard-pie">${turnoCalHTML(t)}</div>` : ''}
      </div>
    </div>`;
  };
  $('#turnosBody').innerHTML = `
    ${googleBannerTurnos()}
    ${prox.length ? prox.map(t => card(t, false)).join('') : '<div class="empty">No tenés turnos próximos.<br>Tocá <b>+</b> para cargar uno y sumarlo a tu Google Calendar.</div>'}
    ${pasados.length ? `<details class="card"><summary>Turnos pasados (${pasados.length})</summary>${pasados.map(t => card(t, true)).join('')}</details>` : ''}`;
}

// ---------- Proyectos: tablero tipo Trello (una columna por proyecto) ----------
function tarjetaTarea(t) {
  const n = t.fecha ? diasHasta(t.fecha) : null;
  const tarde = !t.hecha && n !== null && n < 0;
  return `<div class="tarjeta${t.hecha ? ' hecha' : ''}" draggable="true" data-drag="${t.id}">
    <button type="button" class="tcheck" data-ttoggle="${t.id}" aria-label="${t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}">✓</button>
    <span class="ttexto" data-abrir="tarea:${t.id}">${esc(t.texto)}${t.fecha && !t.hecha ? `<small class="${tarde ? 'rojo' : ''}">${tarde ? 'Atrasada · ' : '📅 '}${esc(cuando(t.fecha))}</small>` : ''}</span>
  </div>`;
}
function columnaTareas(pid) {
  const ts = data.tareas.filter(t => (t.proyectoId || '') === pid);
  const pend = ts.filter(t => !t.hecha).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || a.creado - b.creado);
  const hechas = ts.filter(t => t.hecha).sort((a, b) => b.mod - a.mod);
  return `<div class="tarjetas">${pend.map(tarjetaTarea).join('')}
    ${hechas.length ? `<details class="hechas"><summary>✓ ${hechas.length} hecha${hechas.length > 1 ? 's' : ''}</summary>${hechas.map(tarjetaTarea).join('')}</details>` : ''}</div>
    <form class="tadd" data-tadd="${pid}"><input type="text" placeholder="+ Agregar tarea" aria-label="Nueva tarea" enterkeyhint="done"></form>`;
}
function columnaProyecto(p) {
  const ts = data.tareas.filter(t => t.proyectoId === p.id), hechas = ts.filter(t => t.hecha).length;
  const pct = ts.length ? Math.round((hechas / ts.length) * 100) : 0;
  const n = p.limite ? diasHasta(p.limite) : null;
  return `<section class="columna ${p.estado}" data-drop="${p.id}">
    <div class="col-h" data-abrir="proyecto:${p.id}">
      <span class="proy-emoji">${esc(p.emoji || '🎯')}</span>
      <span class="mid"><b>${esc(p.nombre)}</b><small>${esc([p.estado !== 'activo' ? ESTADOS_PROYECTO[p.estado] : '', ts.length ? `${hechas} de ${ts.length}` : 'Sin tareas',
        p.limite ? (n < 0 && p.estado === 'activo' ? 'se pasó la fecha' : 'hasta ' + cuando(p.limite).toLowerCase()) : ''].filter(Boolean).join(' · '))}</small></span>
      <span class="col-mas" aria-hidden="true">⋯</span>
    </div>
    ${ts.length ? `<div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>` : ''}
    ${p.descripcion ? `<div class="vcard-s nota">${esc(p.descripcion)}</div>` : ''}
    ${columnaTareas(p.id)}
    ${p.limite && p.estado === 'activo' ? `<div class="vcard-pie">${gcalBtn('proyecto:' + p.id, p.gcal, 'Fecha límite a Calendar')}</div>` : ''}
  </section>`;
}
function renderProyectos() {
  const orden = { activo: 0, pausado: 1, terminado: 2 };
  const ps = data.proyectos.slice().sort((a, b) => orden[a.estado] - orden[b.estado] || (a.limite || '9999').localeCompare(b.limite || '9999'));
  const vivos = ps.filter(p => p.estado !== 'terminado'), terminados = ps.filter(p => p.estado === 'terminado');
  const scroll = ($('.tablero') || {}).scrollLeft || 0;
  $('#proyectosBody').innerHTML = `
    ${!vivos.length ? '<p class="muted">Cada proyecto es una columna con sus tareas. Creá el primero con <b>+</b> o con la columna de la derecha.</p>' : ''}
    <div class="tablero">
      ${vivos.map(columnaProyecto).join('')}
      <section class="columna sueltas" data-drop="">
        <div class="col-h"><span class="proy-emoji">📝</span><span class="mid"><b>Tareas sueltas</b><small>Lo que no es de ningún proyecto</small></span></div>
        ${columnaTareas('')}
      </section>
      <button type="button" class="columna nueva" data-nuevo="proyecto"><span>＋</span>Nuevo proyecto</button>
    </div>
    <p class="muted small ayuda-tablero">Deslizá de costado para ver todos tus proyectos. Para pasar una tarea a otro proyecto, arrastrala (en la compu) o tocala y elegí el proyecto.</p>
    ${terminados.length ? `<details class="card"><summary>Proyectos terminados (${terminados.length})</summary>${terminados.map(p =>
      `<div class="ag-item" data-abrir="proyecto:${p.id}"><span class="ag-ico">${esc(p.emoji || '🎯')}</span><span class="mid"><b>${esc(p.nombre)}</b><small>${data.tareas.filter(t => t.proyectoId === p.id).length} tareas</small></span></div>`).join('')}</details>` : ''}`;
  const t = $('.tablero'); if (t) t.scrollLeft = scroll;
}

// ---------- Lechuza: respuestas sobre tu agenda ----------
function periodoAgenda(t) {
  if (/manana/.test(t)) return { desde: 1, hasta: 1, label: 'mañana' };
  if (/\bhoy\b|mi dia/.test(t)) return { desde: -999, hasta: 0, label: 'hoy' };
  if (/mes/.test(t)) return { desde: -999, hasta: 31, label: 'en el próximo mes' };
  return { desde: -999, hasta: 7, label: 'esta semana' };
}
const RV = {
  agenda(t) {
    const per = periodoAgenda(t);
    const evs = agenda().filter(e => { const n = diasHasta(e.fecha); return n <= per.hasta && (n >= per.desde && (n >= 0 || e.atrasable)); });
    if (!evs.length) return [{ mood: 'feliz', texto: `No tenés nada agendado ${per.label}. 🌿 ¿Querés aprovechar para avanzar algún pendiente?`,
      accion: { label: 'Ver proyectos', fn: () => setView('proyectos') } }];
    const lista = evs.slice(0, 8).map(e => {
      const n = diasHasta(e.fecha);
      return `• ${e.ico} <b>${esc(e.titulo)}</b> — ${n < 0 ? '<span class="rojo">atrasado</span>' : esc(cuando(e.fecha).toLowerCase())}${e.hora ? ' ' + esc(e.hora) : ''}`;
    }).join('<br>');
    return [{ mood: evs.some(e => diasHasta(e.fecha) < 0) ? 'atento' : 'feliz', texto: `Esto tenés ${per.label}:<br>${lista}${evs.length > 8 ? `<br>… y ${evs.length - 8} más` : ''}`,
      accion: { label: 'Ver mi agenda', fn: () => setView('inicio') } }];
  },
  turnos() {
    const prox = data.turnos.filter(t => t.estado !== 'cancelado' && t.fecha >= todayISO()).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
    if (!prox.length) return [{ mood: 'pensando', texto: 'No tenés turnos médicos próximos cargados. ¿Sacaste alguno? Cargalo y lo sumamos a tu Google Calendar.',
      accion: { label: 'Cargar turno', fn: () => turnoSheet() } }];
    const lista = prox.slice(0, 5).map(t => `• 🩺 <b>${esc(t.especialidad || 'Turno')}</b>${t.profesional ? ' con ' + esc(t.profesional) : ''} — ${esc(cuando(t.fecha).toLowerCase())}${t.hora ? ' ' + esc(t.hora) : ''}`).join('<br>');
    const faltan = (prox[0].docs || []).filter(d => !d.ok);
    return [{ mood: 'feliz', texto: `Tus próximos turnos:<br>${lista}${faltan.length ? `<br>Para el primero te falta preparar: ${faltan.map(d => esc(d.t)).join(', ')}.` : ''}`,
      accion: { label: 'Ver turnos', fn: () => setView('turnos') } }];
  },
  tramites() {
    const act = data.tramites.filter(x => x.estado !== 'listo').sort((a, b) => proximaFechaTramite(a).localeCompare(proximaFechaTramite(b)));
    if (!act.length) return [{ mood: 'feliz', texto: 'No tenés trámites pendientes. ¡Qué paz! 😌 Si te acordás de alguno, cargalo y yo te lo recuerdo.',
      accion: { label: 'Cargar trámite', fn: () => tramiteSheet() } }];
    const lista = act.slice(0, 6).map(x => {
      const faltan = (x.docs || []).filter(d => !d.ok).length;
      return `• 📋 <b>${esc(x.titulo)}</b> (${esc(ESTADOS_TRAMITE[x.estado].toLowerCase())})${x.vence ? ` — vence ${esc(cuando(x.vence).toLowerCase())}` : ''}${faltan ? ` · faltan ${faltan} papeles` : ''}`;
    }).join('<br>');
    return [{ mood: act.some(x => x.vence && diasHasta(x.vence) <= 7) ? 'atento' : 'pensando', texto: `Tenés ${act.length} trámite${act.length > 1 ? 's' : ''} pendiente${act.length > 1 ? 's' : ''}:<br>${lista}`,
      accion: { label: 'Ver trámites', fn: () => setView('tramites') } }];
  },
  proyectos() {
    const act = data.proyectos.filter(p => p.estado === 'activo');
    const sueltas = data.tareas.filter(t => !t.proyectoId && !t.hecha);
    if (!act.length && !sueltas.length) return [{ mood: 'pensando', texto: 'Todavía no tenés proyectos ni tareas. Creá uno y lo vamos partiendo en pasos chiquitos 💪',
      accion: { label: 'Crear proyecto', fn: () => proyectoSheet() } }];
    const lista = act.slice(0, 5).map(p => {
      const ts = data.tareas.filter(t => t.proyectoId === p.id), h = ts.filter(t => t.hecha).length;
      const sig = ts.filter(t => !t.hecha).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'))[0];
      return `• ${esc(p.emoji || '🎯')} <b>${esc(p.nombre)}</b>: ${ts.length ? Math.round((h / ts.length) * 100) + '%' : 'sin tareas'}${sig ? `<br>&nbsp;&nbsp;Siguiente paso: ${esc(sig.texto)}` : ''}`;
    }).join('<br>');
    return [{ mood: 'feliz', texto: `${act.length ? 'Así van tus proyectos:<br>' + lista : ''}${sueltas.length ? `${act.length ? '<br>' : ''}Además tenés ${sueltas.length} tarea${sueltas.length > 1 ? 's' : ''} suelta${sueltas.length > 1 ? 's' : ''}.` : ''}`,
      accion: { label: 'Ver proyectos', fn: () => setView('proyectos') } }];
  },
  nuevaTarea(texto) {
    texto = texto.trim().replace(/[.!]+$/, '');
    texto = cap(texto);
    return [{ mood: 'pensando', texto: `¿Te anoto la tarea <b>“${esc(texto)}”</b>?`,
      accion: { label: 'Sí, anotala', queda: true, fn: () => { nuevaTareaRapida(texto); return [{ mood: 'feliz', texto: 'Listo, está en <b>Proyectos → Tareas sueltas</b>. Si le querés poner fecha, tocala ahí. ✅' }]; } } }];
  },
  abrir(tipo, label) {
    const fn = { turno: turnoSheet, tramite: tramiteSheet, proyecto: proyectoSheet }[tipo];
    return [{ mood: 'feliz', texto: `¡Dale! Completá los datos y, si tiene fecha, después lo sumás a tu Google Calendar con un toque.`, accion: { label, fn: () => fn() } }];
  },
};

function responderVida(original, t) {
  const plata = /gast|plata|pague|\$|lucas|presupuesto|ahorr|cuanto (sale|cuesta|me queda)|ingreso/.test(t);
  const mT = norm(original).match(/^\s*(?:anota|anotame|agrega|agregame|suma|sumame|recordame|pone|poneme)\s+(?:una\s+|la\s+)?(?:tarea|pendiente)(?:\s+de)?\s*:?\s*(.+)$/)
    || norm(original).match(/^\s*recordame\s+que\s+(.+)$/);
  if (mT) {
    // Uso el texto original (con tildes) desde donde empieza la tarea
    const ini = original.length - mT[1].length;
    return RV.nuevaTarea(original.slice(ini));
  }
  if (plata) return null;
  if (/(nuevo|carga|cargar|cargame|anota|anotame|agenda|agendame|saque|sacar|agrega)\b.*\bturno/.test(t)) return RV.abrir('turno', 'Cargar turno');
  if (/(nuevo|carga|cargar|cargame|anota|anotame|agrega|agregame)\b.*\btramite/.test(t)) return RV.abrir('tramite', 'Cargar trámite');
  if (/(nuevo|crea|crear|creame|arma|armar|agrega|empezar)\b.*\bproyecto/.test(t)) return RV.abrir('proyecto', 'Crear proyecto');
  if (/vacacion|viaje|viajo|valija|pasajes|me voy de/.test(t)) return RV.viajes();
  if (/objetivos?|metas? de la semana|planifica|planear|plan de la semana/.test(t)) return RV.semana();
  if (/turnos?|medic|doctor|dentista|odontolog|ginecolog|dermatolog|analisis|estudios/.test(t)) return RV.turnos();
  if (/tramites?|vence|vencimiento|papeles|expediente|dni|pasaporte|licencia/.test(t)) return RV.tramites();
  if (/proyectos?|tareas?|to ?do|pendientes/.test(t)) return RV.proyectos();
  if (/que tengo|agenda|mi dia|mi semana|que hay (hoy|manana|esta semana)|que me toca|que hago (hoy|manana)|organiz/.test(t)) return RV.agenda(t);
  return null;
}

// ---------- Eventos ----------
function initVida() {
  // Botones que viven dentro de tarjetas clickeables: se atienden antes que la tarjeta
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-gcal]');
    if (g) { e.stopPropagation(); return abrirCalendario(g.dataset.gcal); }
    const c = e.target.closest('[data-chk]');
    if (c) {
      e.stopPropagation();
      const [k, id, i] = c.dataset.chk.split(':');
      const it = buscar(k, id);
      if (it && it.docs[i]) { it.docs[i].ok = !it.docs[i].ok; it.mod = Date.now(); save(); }
      return;
    }
    const tt = e.target.closest('[data-ttoggle]');
    if (tt) { e.stopPropagation(); return toggleTarea(tt.dataset.ttoggle); }
    const n = e.target.closest('[data-nuevo]');
    if (n) { e.stopPropagation(); return n.dataset.nuevo === 'cerrar' ? closeSheet() : nuevo(n.dataset.nuevo); }
    const ir = e.target.closest('[data-ir]');
    if (ir) { e.stopPropagation(); if (ir.dataset.ir === 'gastos') current = monthKey(new Date()); return setView(ir.dataset.ir); }
    const f = e.target.closest('[data-filtro]');
    if (f) { filtroTramites = f.dataset.filtro; return renderTramites(); }
    if (e.target.closest('#inicioLechuza')) return abrirChat();
    const a = e.target.closest('main [data-abrir]');
    if (a && !e.target.closest('details summary, input, form')) abrirRef(a.dataset.abrir);
  }, true);

  // Arrastrar tareas de un proyecto a otro (en la compu)
  let arrastrando = null;
  document.addEventListener('dragstart', e => {
    const c = e.target.closest && e.target.closest('[data-drag]'); if (!c) return;
    arrastrando = c.dataset.drag; c.classList.add('moviendo');
    try { e.dataTransfer.setData('text/plain', arrastrando); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* ignore */ }
  });
  document.addEventListener('dragend', () => { arrastrando = null; document.querySelectorAll('.moviendo, .soltar').forEach(x => x.classList.remove('moviendo', 'soltar')); });
  document.addEventListener('dragover', e => {
    const col = arrastrando && e.target.closest && e.target.closest('[data-drop]'); if (!col) return;
    e.preventDefault();
    document.querySelectorAll('.soltar').forEach(x => x !== col && x.classList.remove('soltar'));
    col.classList.add('soltar');
  });
  document.addEventListener('drop', e => {
    const col = arrastrando && e.target.closest && e.target.closest('[data-drop]'); if (!col) return;
    e.preventDefault();
    const t = buscar('tarea', arrastrando);
    if (t && (t.proyectoId || '') !== col.dataset.drop) { t.proyectoId = col.dataset.drop; t.mod = Date.now(); save(); toast('Tarea movida'); }
  });

  // Agregar tarea escribiendo directo en el proyecto
  $('#view-proyectos').addEventListener('submit', e => {
    const f = e.target.closest('[data-tadd]'); if (!f) return;
    e.preventDefault();
    const inp = f.querySelector('input'), texto = inp.value.trim();
    if (!texto) return;
    nuevaTareaRapida(texto, f.dataset.tadd);
    // Volver a enfocar el campo para cargar varias seguidas
    const q = `[data-tadd="${f.dataset.tadd}"] input`;
    setTimeout(() => { const el = document.querySelector(q); if (el) el.focus(); }, 0);
  });

  $('#miNombre').onchange = e => { setCfg({ nombre: e.target.value.trim().slice(0, 30) }); toast('¡Listo!'); };
}
