'use strict';
// Nido: "Mi semana" (planificar día por día + objetivos) y "Vacaciones" (viajes con presupuesto,
// reservas, valija e itinerario). Usa funciones de app.js y vida.js.

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const EMOJIS_VIAJE = ['✈️', '🏖️', '🏔️', '🏕️', '🚗', '🚌', '🌎', '🏙️', '🚢', '🎒'];
const VALIJA_BASE = ['DNI / pasaporte', 'Cargador del celu', 'Remedios', 'Cepillo y pasta de dientes', 'Ropa interior y medias',
  'Pijama', 'Protector solar', 'Lentes de sol', 'Auriculares', 'Tarjeta / efectivo'];
const PENDIENTES_BASE = ['Pasajes', 'Alojamiento', 'Seguro de viaje'];

function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function sumarDias(iso, n) { const d = isoToDate(iso); d.setDate(d.getDate() + n); return isoDe(d); }
function lunesDe(iso) { const d = isoToDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDe(d); }
const diaCorto = iso => isoToDate(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

// ---------- Mi semana ----------
let semanaIni = lunesDe(isoDe(new Date())), semanaScrollHoy = true;
function semanaHoyODia() { const hoy = todayISO(); return hoy >= semanaIni && hoy <= sumarDias(semanaIni, 6) ? hoy : semanaIni; }

// "18:30 gym" o "9 h médico" → { hora: '18:30', texto: 'gym' }
function separarHora(txt) {
  const m = txt.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|hs)?\s+(.+)$/i);
  if (m && Number(m[1]) < 24) return { hora: String(m[1]).padStart(2, '0') + ':' + (m[2] || '00'), texto: m[3].trim() };
  return { hora: '', texto: txt };
}

function tarjetaPlan(p) {
  return `<div class="tarjeta${p.hecho ? ' hecha' : ''}">
    <button type="button" class="tcheck" data-ptoggle="${p.id}" aria-label="${p.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}">✓</button>
    <span class="ttexto" data-abrir="plan:${p.id}">${p.hora ? `<b class="hora">${esc(p.hora)}</b> ` : ''}${esc(p.texto)}</span>
  </div>`;
}
function tarjetaEvento(e) {
  return `<div class="tarjeta evento">
    ${e.tipo === 'tarea' ? `<button type="button" class="tcheck" data-ttoggle="${e.id}" aria-label="Marcar como hecha">✓</button>` : `<span class="ev-ico">${e.ico}</span>`}
    <span class="ttexto" data-abrir="${e.ref}">${e.hora ? `<b class="hora">${esc(e.hora)}</b> ` : ''}${esc(e.titulo)}<small>${esc(e.sub)}</small></span>
  </div>`;
}

function renderSemana() {
  const fin = sumarDias(semanaIni, 6), hoy = todayISO();
  const ag = agenda().filter(e => e.tipo !== 'plan' && e.fecha >= semanaIni && e.fecha <= fin);
  const objs = data.objetivos.filter(o => o.semana === semanaIni).sort((a, b) => a.creado - b.creado);
  const hechos = objs.filter(o => o.hecho).length;
  const cols = DIAS.map((nombre, i) => {
    const iso = sumarDias(semanaIni, i);
    const viajes = data.viajes.filter(v => v.desde && v.desde < iso && (v.hasta || v.desde) >= iso);
    const items = [
      ...ag.filter(e => e.fecha === iso).map(e => ({ h: e.hora || '', html: tarjetaEvento(e) })),
      ...data.planes.filter(p => p.fecha === iso).map(p => ({ h: p.hora || '', html: tarjetaPlan(p) })),
    ].sort((a, b) => (a.h || '99').localeCompare(b.h || '99'));
    return `<section class="columna dia${iso === hoy ? ' hoy' : ''}${iso < hoy ? ' pasado' : ''}" data-dia="${iso}">
      <div class="col-h"><span class="mid"><b>${nombre}${iso === hoy ? ' · hoy' : ''}</b><small>${diaCorto(iso)}</small></span></div>
      ${viajes.map(v => `<div class="tag viaje-tag" data-abrir="viaje:${v.id}">${esc(v.emoji || '✈️')} De viaje: ${esc(v.destino)}</div>`).join('')}
      <div class="tarjetas">${items.map(x => x.html).join('') || '<p class="vacio">Libre 🌿</p>'}</div>
      <form class="tadd" data-planadd="${iso}"><input type="text" placeholder="+ Planear (ej: 18:30 gym)" aria-label="Planear algo para el ${nombre}" enterkeyhint="done"></form>
    </section>`;
  }).join('');
  const titulo = semanaIni.slice(0, 7) === fin.slice(0, 7)
    ? `${isoToDate(semanaIni).getDate()} al ${diaCorto(fin)}` : `${diaCorto(semanaIni)} al ${diaCorto(fin)}`;
  const scroll = ($('#view-semana .tablero') || {}).scrollLeft || 0;
  $('#semanaBody').innerHTML = `
    <div class="semana-nav">
      <button type="button" class="nav-btn" data-sem="-1" aria-label="Semana anterior">‹</button>
      <b>Semana del ${titulo}</b>
      ${semanaIni !== lunesDe(hoy) ? '<button type="button" class="chip" data-sem="0">Hoy</button>' : ''}
      <button type="button" class="nav-btn" data-sem="1" aria-label="Semana siguiente">›</button>
    </div>
    <div class="card objetivos">
      <h2>🎯 Objetivos de la semana ${objs.length ? `<small class="muted">${hechos} de ${objs.length}</small>` : ''}</h2>
      ${objs.map(o => `<div class="tarea${o.hecho ? ' hecha' : ''}">
        <button type="button" class="tcheck" data-otoggle="${o.id}" aria-label="Marcar objetivo">✓</button>
        <span class="ttexto">${esc(o.texto)}</span>
        <button type="button" class="x-chico" data-odel="${o.id}" aria-label="Borrar objetivo">✕</button></div>`).join('')}
      <form class="tadd" data-objadd="1"><input type="text" placeholder="+ ¿Qué querés lograr esta semana?" aria-label="Nuevo objetivo" enterkeyhint="done"></form>
    </div>
    <div class="tablero">${cols}</div>
    <p class="muted small ayuda-tablero">Acá aparecen solos tus turnos, trámites, tareas con fecha y viajes. Sumá planes escribiendo en cada día.</p>`;
  const t = $('#view-semana .tablero');
  if (t) {
    if (semanaScrollHoy && t.offsetParent) { // solo cuando la sección está a la vista (si no, no hay medidas)
      const h = t.querySelector('.dia.hoy');
      t.scrollLeft = h && window.innerWidth < 900 ? h.offsetLeft - t.offsetLeft - 16 : 0;
      semanaScrollHoy = false;
    } else t.scrollLeft = scroll;
  }
}

function planSheet(p, fecha) {
  const isNew = !p;
  p = p || { texto: '', fecha: fecha || todayISO(), hora: '', hecho: false };
  openSheet({
    title: isNew ? 'Planear algo' : 'Editar plan',
    focus: isNew ? '#lTexto' : null,
    body: `
      <label class="label" for="lTexto">Qué</label>
      <input id="lTexto" type="text" placeholder="Ej: gym, llamar a mamá, hacer las compras" value="${esc(p.texto)}">
      <span class="label">Día y hora (la hora es opcional)</span>
      <div class="row2"><input id="lFecha" type="date" value="${esc(p.fecha)}" aria-label="Día"><input id="lHora" type="time" value="${esc(p.hora)}" aria-label="Hora"></div>
      <label class="check"><input id="lHecho" type="checkbox" ${p.hecho ? 'checked' : ''}> Ya está hecho</label>
      ${!isNew ? `<div class="vcard-pie">${gcalBtn('plan:' + p.id, p.gcal)}</div>` : ''}`,
    onSubmit() {
      const texto = $('#lTexto').value.trim(), fecha = $('#lFecha').value;
      if (!texto) return toast('Escribí qué vas a hacer');
      if (!fecha) return toast('Elegí el día');
      const item = { ...p, id: p.id || uid(), creado: p.creado || Date.now(), mod: Date.now(), texto, fecha, hora: $('#lHora').value, hecho: $('#lHecho').checked };
      if (item.fecha !== p.fecha || item.hora !== p.hora) item.gcal = false;
      guardarEn(data.planes, item); closeSheet(); save();
      toast(isNew ? 'Agregado a tu semana' : 'Plan actualizado');
    },
    onDelete: isNew ? null : () => { borrarDe('plan', p.id); closeSheet(); save(); toast('Plan borrado'); },
  });
}

// ---------- Vacaciones ----------
function estadoViaje(v) {
  const hoy = todayISO();
  if (!v.desde) return { txt: 'Sin fecha', cls: '' };
  if (v.desde > hoy) { const n = diasHasta(v.desde); return { txt: n === 1 ? '¡Mañana!' : `Faltan ${n} días`, cls: n <= 14 ? 'naranja' : '' }; }
  if ((v.hasta || v.desde) >= hoy) return { txt: '¡De viaje! 🎉', cls: 'verde' };
  return { txt: 'Ya fue', cls: '' };
}
const duracion = v => (v.desde && v.hasta ? diasHasta(v.hasta) - diasHasta(v.desde) + 1 : 0);
const gastadoViaje = v => (v.gastos || []).reduce((a, g) => a + (Number(g.monto) || 0), 0);
const moneyV = (n, v) => money(n, v.moneda === 'USD' ? 'USD' : 'ARS');
const contar = l => `${(l || []).filter(x => x.ok).length}/${(l || []).length}`;
function proximoViaje() {
  const hoy = todayISO();
  return data.viajes.filter(v => v.desde && (v.hasta || v.desde) >= hoy).sort((a, b) => a.desde.localeCompare(b.desde))[0];
}

function renderVacaciones() {
  const hoy = todayISO();
  const vienen = data.viajes.filter(v => !v.desde || (v.hasta || v.desde) >= hoy).sort((a, b) => (a.desde || '9999').localeCompare(b.desde || '9999'));
  const fueron = data.viajes.filter(v => v.desde && (v.hasta || v.desde) < hoy).sort((a, b) => b.desde.localeCompare(a.desde));
  const card = v => {
    const e = estadoViaje(v), gast = gastadoViaje(v), dur = duracion(v);
    const pct = v.presupuesto ? Math.min(100, (gast / v.presupuesto) * 100) : 0;
    return `<div class="vcard viaje" data-abrir="viaje:${v.id}">
      <div class="viaje-emoji">${esc(v.emoji || '✈️')}</div>
      <div class="grow">
        <div class="vcard-h"><b>${esc(v.destino)}</b><span class="tag ${e.cls}">${e.txt}</span></div>
        <div class="vcard-s">${v.desde ? esc(fechaCorta(v.desde)) + (v.hasta && v.hasta !== v.desde ? ' → ' + esc(fechaCorta(v.hasta)) : '') + (dur ? ` · ${dur} días` : '') : 'Todavía sin fechas'}</div>
        <div class="tags"><span class="tag">✅ Reservas ${contar(v.pendientes)}</span><span class="tag">🧳 Valija ${contar(v.valija)}</span>${v.presupuesto ? `<span class="tag">💰 ${moneyV(gast, v)} de ${moneyV(v.presupuesto, v)}</span>` : ''}</div>
        ${v.presupuesto ? `<div class="bar"><div class="bar-fill ${pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''}" style="width:${pct}%"></div></div>` : ''}
      </div>
    </div>`;
  };
  $('#vacacionesBody').innerHTML = `
    ${vienen.length ? vienen.map(card).join('') : '<div class="empty">🏖️<br>¿A dónde te vas?<br>Tocá <b>+</b> para armar tu próximo viaje: presupuesto, reservas, valija e itinerario día por día.</div>'}
    ${fueron.length ? `<details class="card"><summary>Viajes anteriores (${fueron.length})</summary>${fueron.map(card).join('')}</details>` : ''}`;
}

function statViaje() {
  const v = proximoViaje();
  if (!v) return `<div class="card stat" data-ir="vacaciones"><span>🏖️ Vacaciones</span><b>—</b><span>Planeá tu próximo viaje</span></div>`;
  const e = estadoViaje(v);
  return `<div class="card stat" data-ir="vacaciones"><span>${esc(v.emoji || '🏖️')} Vacaciones</span><b>${esc(e.txt.replace('Faltan ', ''))}</b><span>${esc(v.destino)}</span></div>`;
}

function viajeSheet(v) {
  const isNew = !v;
  v = v || { destino: '', emoji: '✈️', desde: '', hasta: '', presupuesto: '', moneda: 'ARS' };
  openSheet({
    title: isNew ? 'Nuevo viaje' : 'Datos del viaje',
    focus: isNew ? '#vDestino' : null,
    body: `
      <div class="chips" id="emojiViaje">${EMOJIS_VIAJE.map(e => `<button type="button" class="chip emoji${e === v.emoji ? ' on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
      <label class="label" for="vDestino">¿A dónde?</label>
      <input id="vDestino" type="text" placeholder="Ej: Bariloche, Florianópolis, Mendoza" value="${esc(v.destino)}">
      <span class="label">Desde y hasta</span>
      <div class="row2"><input id="vDesde" type="date" value="${esc(v.desde)}" aria-label="Desde"><input id="vHasta" type="date" value="${esc(v.hasta)}" aria-label="Hasta"></div>
      <span class="label">Presupuesto (opcional)</span>
      <div class="row2"><input id="vPres" type="text" inputmode="decimal" placeholder="0" value="${v.presupuesto ? esc(fmtNum.format(v.presupuesto)) : ''}" aria-label="Presupuesto">
        <select id="vMoneda" aria-label="Moneda"><option value="ARS"${v.moneda !== 'USD' ? ' selected' : ''}>Pesos</option><option value="USD"${v.moneda === 'USD' ? ' selected' : ''}>Dólares</option></select></div>`,
    onSubmit() {
      const destino = $('#vDestino').value.trim();
      if (!destino) return toast('Poné a dónde vas');
      const desde = $('#vDesde').value; let hasta = $('#vHasta').value;
      if (desde && hasta && hasta < desde) return toast('La vuelta es antes de la ida');
      if (desde && !hasta) hasta = desde;
      const pres = parseMonto($('#vPres').value);
      const on = document.querySelector('#emojiViaje .chip.on');
      const item = { pendientes: PENDIENTES_BASE.map(t => ({ t, ok: false })), valija: [], gastos: [], dias: {}, notas: '',
        ...v, id: v.id || uid(), creado: v.creado || Date.now(), mod: Date.now(), destino, desde, hasta,
        presupuesto: pres > 0 ? pres : 0, moneda: $('#vMoneda').value, emoji: on ? on.dataset.emoji : '✈️' };
      if (item.desde !== v.desde || item.hasta !== v.hasta) item.gcal = false;
      guardarEn(data.viajes, item); closeSheet();
      if (view !== 'vacaciones' && isNew) setView('vacaciones');
      save();
      abrirViaje(item);
      if (isNew) toast('¡Viaje creado! Armá tu lista y tu itinerario');
    },
    onDelete: isNew ? null : () => {
      if (!confirm(`¿Borrar el viaje a ${v.destino}?`)) return;
      borrarDe('viaje', v.id); closeSheet(); cerrarViaje(); save(); toast('Viaje borrado');
    },
  });
  $('#emojiViaje').onclick = e => {
    const c = e.target.closest('[data-emoji]'); if (!c) return;
    document.querySelectorAll('#emojiViaje .chip').forEach(x => x.classList.toggle('on', x === c));
  };
}

let viajeAbierto = null;
function abrirViaje(v) {
  viajeAbierto = v.id;
  renderViaje();
  $('#viajePanel').hidden = false;
  document.body.classList.add('sin-scroll');
}
function cerrarViaje() {
  viajeAbierto = null;
  $('#viajePanel').hidden = true;
  document.body.classList.remove('sin-scroll');
  render();
}
function checklistViaje(v, lista, placeholder) {
  return `${(v[lista] || []).map((d, i) => `<div class="tarea${d.ok ? ' hecha' : ''}">
      <button type="button" class="tcheck" data-vchk="${lista}:${i}" aria-label="Tildar">✓</button>
      <span class="ttexto">${esc(d.t)}</span>
      <button type="button" class="x-chico" data-vdel="${lista}:${i}" aria-label="Borrar">✕</button></div>`).join('')}
    <form class="tadd" data-vadd="${lista}"><input type="text" placeholder="${placeholder}" aria-label="${placeholder}" enterkeyhint="done"></form>`;
}
function renderViaje() {
  const v = buscar('viaje', viajeAbierto);
  if (!v) return cerrarViaje();
  const e = estadoViaje(v), gast = gastadoViaje(v), dur = duracion(v);
  const resta = v.presupuesto - gast;
  const dias = [];
  if (v.desde && v.hasta) for (let i = 0; i < Math.min(dur, 45); i++) dias.push(sumarDias(v.desde, i));
  $('#viajeTitulo').textContent = (v.emoji || '✈️') + ' ' + v.destino;
  $('#viajeBody').innerHTML = `
    <div class="viaje-head card">
      <div class="viaje-emoji grande">${esc(v.emoji || '✈️')}</div>
      <div class="grow">
        <b class="viaje-destino">${esc(v.destino)}</b>
        <div class="vcard-s">${v.desde ? esc(fechaCorta(v.desde)) + (v.hasta && v.hasta !== v.desde ? ' → ' + esc(fechaCorta(v.hasta)) : '') + (dur ? ` · ${dur} días` : '') : 'Todavía sin fechas'}</div>
        <div class="tags"><span class="tag ${e.cls}">${e.txt}</span></div>
      </div>
    </div>
    <div class="vcard-pie">
      <button type="button" class="gcal" data-veditar="1">✏️ Editar datos</button>
      ${v.desde ? gcalBtn('viaje:' + v.id, v.gcal) : ''}
    </div>

    <div class="card"><h2>💰 Presupuesto</h2>
      ${v.presupuesto ? `<div class="sum-grid"><div><span class="label">Presupuesto</span><b>${moneyV(v.presupuesto, v)}</b></div>
        <div><span class="label">${resta >= 0 ? 'Te queda' : 'Te pasaste'}</span><b class="${resta < 0 ? 'neg' : ''}">${moneyV(Math.abs(resta), v)}</b></div></div>
        <div class="bar"><div class="bar-fill ${gast >= v.presupuesto ? 'over' : gast >= v.presupuesto * 0.8 ? 'warn' : ''}" style="width:${Math.min(100, (gast / v.presupuesto) * 100)}%"></div></div>`
        : '<p class="muted">Poné un presupuesto en <b>Editar datos</b> y anotá acá lo que vas pagando.</p>'}
      ${(v.gastos || []).length ? `<div class="vgastos">${v.gastos.map((g, i) => `<div class="line-item sin-click"><span>${esc(g.t)}</span><span><b>${moneyV(g.monto, v)}</b> <button type="button" class="x-chico" data-vdel="gastos:${i}" aria-label="Borrar gasto">✕</button></span></div>`).join('')}
        <div class="line-item sin-click total"><span>Total</span><b>${moneyV(gast, v)}</b></div></div>` : ''}
      <form class="vgasto-form" data-vgasto="1"><input type="text" id="vgT" placeholder="Ej: pasajes, hotel, excursión" aria-label="Concepto"><input type="text" id="vgM" inputmode="decimal" placeholder="Monto" aria-label="Monto"><button class="btn secondary" type="submit">+</button></form>
    </div>

    <div class="card"><h2>✅ Reservas y pendientes <small class="muted">${contar(v.pendientes)}</small></h2>
      ${checklistViaje(v, 'pendientes', '+ Agregar (ej: cambiar dólares)')}
    </div>

    <div class="card"><h2>🧳 Valija <small class="muted">${contar(v.valija)}</small></h2>
      ${checklistViaje(v, 'valija', '+ Agregar a la valija')}
      <button type="button" class="btn ghost full" data-vbase="1">Sumar lista básica</button>
    </div>

    <div class="card"><h2>🗺️ Itinerario</h2>
      ${dias.length ? dias.map((d, i) => `<label class="label" for="vd-${d}">Día ${i + 1} · ${esc(cap(fechaCorta(d)))}</label>
        <textarea class="campo" id="vd-${d}" data-vdia="${d}" rows="2" placeholder="Qué vas a hacer este día">${esc((v.dias || {})[d] || '')}</textarea>`).join('')
        : '<p class="muted">Poné las fechas del viaje y te armo un espacio para cada día.</p>'}
    </div>

    <div class="card"><h2>💡 Notas e ideas</h2>
      <textarea class="campo" id="vNotas" rows="4" placeholder="Lugares para conocer, restaurantes, datos útiles…">${esc(v.notas || '')}</textarea>
    </div>`;
}

function tocarViaje(v) { v.mod = Date.now(); save(); renderViaje(); }

// ---------- Lechuza ----------
RV.semana = function () {
  const ini = lunesDe(todayISO());
  const objs = data.objetivos.filter(o => o.semana === ini);
  const planes = data.planes.filter(p => p.fecha >= ini && p.fecha <= sumarDias(ini, 6));
  const txt = objs.length
    ? `Tus objetivos de esta semana (${objs.filter(o => o.hecho).length} de ${objs.length}):<br>${objs.map(o => `${o.hecho ? '✅' : '⬜'} ${esc(o.texto)}`).join('<br>')}`
    : 'Todavía no pusiste objetivos para esta semana. Elegí 2 o 3 cosas importantes: es más fácil cumplirlas si están escritas. 💪';
  return [{ mood: 'feliz', texto: txt + (planes.length ? `<br>Además tenés ${planes.filter(p => !p.hecho).length} planes pendientes en la semana.` : ''),
    accion: { label: 'Ver mi semana', fn: () => setView('semana') } }];
};
RV.viajes = function () {
  const v = proximoViaje();
  if (!v) return [{ mood: 'feliz', texto: 'No tenés viajes en camino. ¿Armamos uno? Te ayudo con el presupuesto, las reservas y la valija 🏖️',
    accion: { label: 'Nuevo viaje', fn: () => viajeSheet() } }];
  const e = estadoViaje(v);
  const faltan = (v.pendientes || []).filter(x => !x.ok).map(x => esc(x.t));
  let txt = `${esc(v.emoji || '✈️')} <b>${esc(v.destino)}</b>: ${e.txt.toLowerCase()}.`;
  if (faltan.length) txt += `<br>Te falta: ${faltan.slice(0, 4).join(', ')}.`;
  if ((v.valija || []).length) txt += `<br>Valija: ${contar(v.valija)} listo.`;
  if (v.presupuesto) txt += `<br>Llevás ${moneyV(gastadoViaje(v), v)} de ${moneyV(v.presupuesto, v)} de presupuesto.`;
  return [{ mood: faltan.length && diasHasta(v.desde) <= 14 ? 'atento' : 'feliz', texto: txt, accion: { label: 'Ver viaje', fn: () => { setView('vacaciones'); abrirViaje(v); } } }];
};

// ---------- Eventos ----------
function initPlan() {
  $('#semanaBody').addEventListener('click', e => {
    const s = e.target.closest('[data-sem]');
    if (s) { const n = Number(s.dataset.sem); semanaIni = n ? sumarDias(semanaIni, 7 * n) : lunesDe(todayISO()); semanaScrollHoy = !n; return renderSemana(); }
    const pt = e.target.closest('[data-ptoggle]');
    if (pt) { const p = buscar('plan', pt.dataset.ptoggle); if (p) { p.hecho = !p.hecho; p.mod = Date.now(); save(); if (p.hecho) toast('¡Hecho! ✓'); } return; }
    const ot = e.target.closest('[data-otoggle]');
    if (ot) { const o = buscar('objetivo', ot.dataset.otoggle); if (o) { o.hecho = !o.hecho; o.mod = Date.now(); save(); if (o.hecho) toast('¡Objetivo cumplido! 🎯'); } return; }
    const od = e.target.closest('[data-odel]');
    if (od) { borrarDe('objetivo', od.dataset.odel); save(); }
  });
  $('#view-semana').addEventListener('submit', e => {
    const f = e.target; e.preventDefault();
    const inp = f.querySelector('input'), txt = inp.value.trim(); if (!txt) return;
    let q;
    if (f.dataset.planadd) {
      const { hora, texto } = separarHora(txt);
      data.planes.push({ id: uid(), creado: Date.now(), mod: Date.now(), texto, fecha: f.dataset.planadd, hora, hecho: false });
      q = `[data-planadd="${f.dataset.planadd}"] input`;
    } else if (f.dataset.objadd) {
      data.objetivos.push({ id: uid(), creado: Date.now(), mod: Date.now(), semana: semanaIni, texto: txt, hecho: false });
      q = '[data-objadd] input';
    }
    save();
    setTimeout(() => { const el = document.querySelector(q); if (el) el.focus(); }, 0);
  });

  // Panel del viaje
  $('#viajeCerrar').onclick = cerrarViaje;
  $('#viajeBody').addEventListener('click', e => {
    const v = buscar('viaje', viajeAbierto); if (!v) return;
    const ch = e.target.closest('[data-vchk]');
    if (ch) { const [l, i] = ch.dataset.vchk.split(':'); v[l][i].ok = !v[l][i].ok; return tocarViaje(v); }
    const dl = e.target.closest('[data-vdel]');
    if (dl) { const [l, i] = dl.dataset.vdel.split(':'); v[l].splice(Number(i), 1); return tocarViaje(v); }
    if (e.target.closest('[data-vbase]')) {
      const ya = new Set((v.valija || []).map(x => x.t));
      v.valija = (v.valija || []).concat(VALIJA_BASE.filter(t => !ya.has(t)).map(t => ({ t, ok: false })));
      return tocarViaje(v);
    }
    if (e.target.closest('[data-veditar]')) viajeSheet(v);
  });
  $('#viajeBody').addEventListener('submit', e => {
    e.preventDefault();
    const v = buscar('viaje', viajeAbierto); if (!v) return;
    const f = e.target;
    if (f.dataset.vadd) {
      const inp = f.querySelector('input'), t = inp.value.trim(); if (!t) return;
      (v[f.dataset.vadd] = v[f.dataset.vadd] || []).push({ t, ok: false });
      tocarViaje(v);
      setTimeout(() => { const el = document.querySelector(`#viajeBody [data-vadd="${f.dataset.vadd}"] input`); if (el) el.focus(); }, 0);
    } else if (f.dataset.vgasto) {
      const t = $('#vgT').value.trim(), monto = parseMonto($('#vgM').value);
      if (!t) return toast('Poné qué pagaste');
      if (!(monto > 0)) return toast('Poné un monto válido');
      (v.gastos = v.gastos || []).push({ id: uid(), t, monto });
      tocarViaje(v);
    }
  });
  // Itinerario y notas: se guardan solos mientras escribís
  let tm;
  $('#viajeBody').addEventListener('input', e => {
    const v = buscar('viaje', viajeAbierto); if (!v) return;
    const el = e.target;
    if (!el.dataset.vdia && el.id !== 'vNotas') return;
    clearTimeout(tm);
    tm = setTimeout(() => {
      if (el.dataset.vdia) v.dias = { ...(v.dias || {}), [el.dataset.vdia]: el.value };
      else v.notas = el.value;
      v.mod = Date.now(); save();
    }, 600);
  });
}
