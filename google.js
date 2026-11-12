'use strict';
// Nido: turnos médicos sincronizados con Google Calendar (API oficial de Google, sin servidores).
// - Cada turno se crea, cambia o borra solo en tu Calendar (con avisos 1 día y 2 horas antes).
// - Si movés o borrás un turno desde Calendar, Nido se entera y lo actualiza.
// - Busca en tu Calendar eventos que parecen turnos médicos y te ofrece sumarlos.
// También: la tarjeta "Tus datos" de Ajustes (respaldos y traer lo de Mis Gastos).

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GCAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GTOKEN_KEY = 'nido-gtoken';
const GIGNORADOS_KEY = 'nido-g-ignorados';
const PARECE_TURNO = /turno|m[eé]dic|\bdr\.?\s|\bdra\.?\s|odont|dentista|cl[ií]nica|sanatorio|hospital|an[aá]lisis|laborator|ecograf|radiograf|psic[oó]log|kinesi|oftalm|dermat|ginec|cardi[oó]|traumat|nutrici|pediatr|vacuna|mamograf|resonancia/i;

let gTokenClient = null, gToken = null, gTokenExp = 0, gSincronizando = false, gUltimoPull = 0, gTimer = null;
let gSugerencias = [], gError = '';

try { const t = JSON.parse(localStorage.getItem(GTOKEN_KEY) || 'null'); if (t) { gToken = t.token; gTokenExp = t.exp; } } catch (e) { /* ignore */ }

const gClientId = () => String(cfg().googleClientId || '').trim();
const googleActivo = () => !!(cfg().googleConectado && gClientId());
const gTokenValido = () => !!gToken && Date.now() < gTokenExp - 60000;
const turnoPendienteG = t => (!t.gEventId && t.estado !== 'cancelado' && t.fecha >= sumarDias(todayISO(), -7)) || (t.gEventId && t.mod > (t.gSync || 0) + 1000);
function gIgnorados() { try { return JSON.parse(localStorage.getItem(GIGNORADOS_KEY) || '[]'); } catch (e) { return []; } }

// ---------- Inicio de sesión con Google ----------
function cargarGIS() {
  return new Promise((res, rej) => {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    let s = document.querySelector('script[data-gis]');
    if (!s) { s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.dataset.gis = '1'; document.head.append(s); }
    s.addEventListener('load', () => res()); s.addEventListener('error', () => rej(new Error('gis')));
  });
}
function precargarGoogle() { if (gClientId() && navigator.onLine) cargarGIS().then(prepararCliente).catch(() => {}); }
function prepararCliente() {
  if (gTokenClient || !gClientId() || !(window.google && google.accounts && google.accounts.oauth2)) return !!gTokenClient;
  gTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: gClientId(), scope: GCAL_SCOPE,
    callback: r => {
      if (r.error) { gError = 'Google no dio permiso (' + r.error + ').'; return renderAjustesGoogle(); }
      gToken = r.access_token; gTokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000; gError = '';
      try { localStorage.setItem(GTOKEN_KEY, JSON.stringify({ token: gToken, exp: gTokenExp })); } catch (e) { /* ignore */ }
      if (!cfg().googleConectado) { setCfg({ googleConectado: true }); toast('¡Google Calendar conectado! 📅'); }
      sincronizarGoogle(true);
    },
    error_callback: err => { gError = err && err.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de terminar.' : 'No se pudo abrir la ventana de Google. Revisá que no esté bloqueando ventanas emergentes.'; renderAjustesGoogle(); },
  });
  return true;
}
// Tiene que llamarse directo desde un toque (si no, el navegador bloquea la ventana de Google)
function pedirPermisoGoogle() {
  if (!gClientId()) { toast('Primero pegá el ID de cliente de Google'); return setView('ajustes'); }
  if (!navigator.onLine) return toast('Necesitás internet para conectar Google');
  if (!prepararCliente()) { toast('Preparando Google… tocá de nuevo en un segundo'); return precargarGoogle(); }
  gTokenClient.requestAccessToken({ prompt: cfg().googleConectado ? '' : 'consent' });
}

async function gapi(path, opts = {}) {
  const res = await fetch(GCAL_API + path, { ...opts, headers: { Authorization: 'Bearer ' + gToken, 'Content-Type': 'application/json' } });
  if (res.status === 401) { gToken = null; try { localStorage.removeItem(GTOKEN_KEY); } catch (e) { /* ignore */ } }
  if (!res.ok) { const err = new Error('Google ' + res.status); err.status = res.status; throw err; }
  return res.status === 204 ? null : res.json();
}

// ---------- Del turno al evento y del evento al turno ----------
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const localDT = d => isoDe(d) + 'T' + hhmm(d) + ':00';
function eventoGoogle(t) {
  const ev = eventoDe('turno:' + t.id).ev;
  let start, end;
  if (t.hora) {
    const ini = isoToDate(t.fecha); const [h, m] = t.hora.split(':').map(Number); ini.setHours(h, m || 0);
    const fin = new Date(ini.getTime() + 60 * 60000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    start = { dateTime: localDT(ini), timeZone }; end = { dateTime: localDT(fin), timeZone };
  } else { start = { date: t.fecha }; end = { date: sumarDias(t.fecha, 1) }; }
  return {
    summary: ev.titulo, location: t.lugar || '', start, end,
    description: (ev.detalles ? ev.detalles + '\n\n' : '') + 'Turno cargado desde Nido',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }, { method: 'popup', minutes: 120 }] },
    extendedProperties: { private: { nido: 'turno', nidoId: t.id } },
  };
}
function fechaHoraDeEvento(e) {
  if (e.start && e.start.dateTime) { const d = new Date(e.start.dateTime); return { fecha: isoDe(d), hora: hhmm(d) }; }
  return { fecha: e.start && e.start.date, hora: '' };
}
// Si el evento cambió en Calendar (y en Nido no hay cambios sin subir), Nido toma lo de Calendar
function aplicarDesdeGoogle(t, e) {
  const ahora = Date.now();
  if (e.status === 'cancelled') {
    delete t.gEventId; t.gcal = false;
    if (t.estado !== 'cancelado' && t.fecha >= todayISO()) t.estado = 'cancelado';
    t.mod = t.gSync = ahora; return true;
  }
  if (e.updated === t.gUpdated || turnoPendienteG(t)) return false;
  const { fecha, hora } = fechaHoraDeEvento(e);
  Object.assign(t, { fecha: fecha || t.fecha, hora, lugar: e.location || t.lugar, gUpdated: e.updated, mod: ahora, gSync: ahora });
  return true;
}

// ---------- Sincronizar ----------
function programarGoogle(traer = false) {
  if (!googleActivo() || !gTokenValido()) return;
  clearTimeout(gTimer);
  gTimer = setTimeout(() => sincronizarGoogle(traer || Date.now() - gUltimoPull > 5 * 60000), 1500);
}

async function sincronizarGoogle(traer = false) {
  if (!googleActivo() || !gTokenValido() || gSincronizando || !navigator.onLine) return;
  gSincronizando = true;
  let cambios = false;
  try {
    // 1) Borrar de Calendar los turnos que borraste en Nido (en cualquier dispositivo)
    for (const b of data.gcalBorrar.slice()) {
      try { await gapi('/' + encodeURIComponent(b.id), { method: 'DELETE' }); } catch (e) { if (![404, 410].includes(e.status)) throw e; }
      borrarDe('gcalBorrar', b.id); cambios = true;
    }
    // 2) Traer lo que cambió en Calendar
    if (traer) {
      const desde = new Date(Date.now() - 90 * 864e5).toISOString();
      const r = await gapi(`?privateExtendedProperty=${encodeURIComponent('nido=turno')}&showDeleted=true&maxResults=2500&timeMin=${encodeURIComponent(desde)}`);
      const porId = new Map((r.items || []).map(e => [e.id, e]));
      for (const t of data.turnos.filter(t => t.gEventId)) {
        let e = porId.get(t.gEventId);
        if (!e) { // turno que vino de un evento tuyo (sin marca de Nido): lo busco aparte
          try { e = await gapi('/' + encodeURIComponent(t.gEventId)); } catch (err) { if ([404, 410].includes(err.status)) e = { status: 'cancelled' }; else throw err; }
        }
        if (aplicarDesdeGoogle(t, e)) cambios = true;
      }
      // Eventos de tu Calendar que parecen turnos médicos y todavía no están en Nido
      const hasta = new Date(Date.now() + 180 * 864e5).toISOString();
      const prox = await gapi(`?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(new Date().toISOString())}&timeMax=${encodeURIComponent(hasta)}`);
      const vinculados = new Set(data.turnos.map(t => t.gEventId).filter(Boolean)), ign = new Set(gIgnorados());
      gSugerencias = (prox.items || []).filter(e => e.status !== 'cancelled' && !vinculados.has(e.id) && !ign.has(e.id)
        && !(e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.nido) && PARECE_TURNO.test(e.summary || ''));
      gUltimoPull = Date.now();
    }
    // 3) Subir los turnos nuevos o cambiados en Nido
    for (const t of data.turnos.filter(t => t.fecha && turnoPendienteG(t))) {
      if (t.estado === 'cancelado') {
        if (t.gEventId) { try { await gapi('/' + encodeURIComponent(t.gEventId), { method: 'DELETE' }); } catch (e) { if (![404, 410].includes(e.status)) throw e; } }
        delete t.gEventId; t.gcal = false;
      } else if (t.gEventId) {
        try {
          const e = await gapi('/' + encodeURIComponent(t.gEventId), { method: 'PATCH', body: JSON.stringify(eventoGoogle(t)) });
          t.gUpdated = e.updated;
        } catch (err) {
          if (![404, 410].includes(err.status)) throw err;
          const e = await gapi('', { method: 'POST', body: JSON.stringify(eventoGoogle(t)) });
          t.gEventId = e.id; t.gUpdated = e.updated;
        }
        t.gcal = true;
      } else {
        const e = await gapi('', { method: 'POST', body: JSON.stringify(eventoGoogle(t)) });
        t.gEventId = e.id; t.gUpdated = e.updated; t.gcal = true;
      }
      t.gSync = Date.now(); t.mod = t.gSync; cambios = true;
    }
    gError = '';
  } catch (e) {
    gError = e.status === 401 ? 'Se venció el permiso de Google: tocá Reconectar.' : e.status === 403 ? 'Google rechazó el pedido. Revisá que la API de Calendar esté habilitada.' : 'No se pudo sincronizar con Google (' + (e.status || 'sin red') + ').';
  } finally {
    gSincronizando = false;
    if (cambios) save(); else render();
  }
}

function importarDeGoogle(id) {
  const e = gSugerencias.find(x => x.id === id); if (!e) return;
  const { fecha, hora } = fechaHoraDeEvento(e), ahora = Date.now();
  data.turnos.push({ id: uid(), creado: ahora, mod: ahora, especialidad: (e.summary || 'Turno').slice(0, 80), profesional: '', fecha, hora,
    lugar: e.location || '', docs: [], nota: (e.description || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 300), estado: 'pendiente',
    gEventId: e.id, gUpdated: e.updated, gSync: ahora, gcal: true });
  gSugerencias = gSugerencias.filter(x => x.id !== id);
  save(); toast('Turno sumado a Nido');
}
function ignorarDeGoogle(id) {
  try { localStorage.setItem(GIGNORADOS_KEY, JSON.stringify(gIgnorados().concat(id).slice(-300))); } catch (e) { /* ignore */ }
  gSugerencias = gSugerencias.filter(x => x.id !== id); render();
}

// ---------- Lo que se ve ----------
function turnoCalHTML(t) {
  if (!googleActivo()) return gcalBtn('turno:' + t.id, t.gcal);
  if (t.estado === 'cancelado') return '';
  return turnoPendienteG(t)
    ? '<span class="gsync">⏳ Se sincroniza con Calendar</span>'
    : '<span class="gsync ok">✓ En tu Google Calendar</span>';
}
function googleBannerTurnos() {
  if (!googleActivo()) {
    return `<p class="muted small tip-google">💡 ¿Querés que tus turnos aparezcan solos en Google Calendar? <a href="#" data-ir="ajustes">Conectalo en Ajustes</a>.</p>`;
  }
  const pend = data.turnos.filter(turnoPendienteG).length + data.gcalBorrar.length;
  if (!gTokenValido()) {
    return `<div class="card banner-google"><div><b>📅 Google Calendar</b><p class="muted small">Por seguridad, Google pide confirmar cada tanto.${pend ? ` Hay ${pend} cambio${pend > 1 ? 's' : ''} esperando para sincronizar.` : ''}</p></div>
      <button type="button" class="btn primary" data-greconectar="1">Reconectar</button></div>`;
  }
  return (gError ? `<p class="muted small rojo">${esc(gError)}</p>` : '') + (gSugerencias.length ? `<div class="card banner-google col">
    <b>📅 Encontré ${gSugerencias.length} evento${gSugerencias.length > 1 ? 's' : ''} en tu Calendar que parece${gSugerencias.length > 1 ? 'n' : ''} turno${gSugerencias.length > 1 ? 's' : ''} médico${gSugerencias.length > 1 ? 's' : ''}</b>
    ${gSugerencias.slice(0, 6).map(e => { const { fecha, hora } = fechaHoraDeEvento(e); return `<div class="ag-item sin-click">
      <span class="ag-ico">🩺</span><span class="mid"><b>${esc(e.summary || 'Evento')}</b><small>${esc(cuando(fecha))}${hora ? ' · ' + hora : ''}${e.location ? ' · ' + esc(e.location) : ''}</small></span>
      <button type="button" class="btn secondary chico" data-gimport="${esc(e.id)}">Sumar</button><button type="button" class="x-chico" data-gignorar="${esc(e.id)}" aria-label="No es un turno">✕</button></div>`; }).join('')}
  </div>` : '');
}

function renderAjustesGoogle() {
  if (!$('#gEstado')) return;
  if (document.activeElement !== $('#gClientId')) $('#gClientId').value = gClientId();
  const activo = googleActivo();
  $('#gConectar').textContent = !activo ? 'Conectar Google Calendar' : gTokenValido() ? 'Sincronizar ahora' : 'Reconectar';
  $('#gDesconectar').hidden = !activo;
  const n = data.turnos.filter(t => t.gEventId).length;
  $('#gEstado').innerHTML = gError ? `<span class="rojo">${esc(gError)}</span>`
    : !gClientId() ? `Para conectarlo hace falta un ID de cliente de Google (es gratis y se hace una sola vez). En Google Cloud, autorizá este origen: <b>${esc(location.origin)}</b>. Los pasos están en el README del repo.`
    : !activo ? 'Listo para conectar. Te va a aparecer una ventana de Google para dar permiso.'
    : gTokenValido() ? `✓ Conectado. ${n} turno${n === 1 ? '' : 's'} en tu Calendar.${gSincronizando ? ' Sincronizando…' : ''}`
    : 'Conectado, pero Google pide confirmar de nuevo: tocá Reconectar.';
}

function renderAjustesDatos() {
  const r = leerRespaldo(), ant = leerRespaldo(RESPALDO_KEY + '-anterior');
  const f = x => new Date(x.fecha).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  $('#respaldoInfo').textContent = r ? `Última copia: ${f(r)} (${r.motivo})${ant ? ` · anterior: ${f(ant)}` : ''}.` : 'Todavía no hay copias.';
  $('#restaurarRespaldo').disabled = !r;
}

function initGoogle() {
  precargarGoogle();
  $('#gClientId').onchange = e => {
    const v = e.target.value.trim();
    if (v && !/\.apps\.googleusercontent\.com$/.test(v)) toast('Ojo: el ID suele terminar en .apps.googleusercontent.com');
    gTokenClient = null; setCfg({ googleClientId: v }); precargarGoogle();
  };
  $('#gConectar').onclick = () => (googleActivo() && gTokenValido() ? sincronizarGoogle(true) : pedirPermisoGoogle());
  $('#gDesconectar').onclick = () => {
    if (!confirm('¿Desconectar Google Calendar? Los eventos que ya están en tu Calendar quedan ahí.')) return;
    try { if (gToken && window.google) google.accounts.oauth2.revoke(gToken, () => {}); } catch (e) { /* ignore */ }
    gToken = null; try { localStorage.removeItem(GTOKEN_KEY); } catch (e) { /* ignore */ }
    setCfg({ googleConectado: false }); toast('Google Calendar desconectado');
  };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-greconectar]')) { e.stopPropagation(); return pedirPermisoGoogle(); }
    const im = e.target.closest('[data-gimport]');
    if (im) { e.stopPropagation(); return importarDeGoogle(im.dataset.gimport); }
    const ig = e.target.closest('[data-gignorar]');
    if (ig) { e.stopPropagation(); return ignorarDeGoogle(ig.dataset.gignorar); }
    const a = e.target.closest('a[data-ir]');
    if (a) e.preventDefault();
  }, true);

  $('#traerMisGastos').onclick = () => traerDeMisGastos();
  $('#restaurarRespaldo').onclick = () => {
    const r = leerRespaldo(); if (!r) return;
    const cuando = new Date(r.fecha).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    if (!confirm(`¿Volver a cómo estaban tus datos el ${cuando}? Lo que cargaste después en este dispositivo se pierde (antes guardo una copia de cómo está ahora, por las dudas).`)) return;
    const vieja = r.data;
    guardarRespaldo('antes de volver a una copia');
    data = normalize(vieja); data.updatedAt = Date.now();
    persistLocal(); render(); toast('Listo: volviste a la copia de seguridad');
  };
}
