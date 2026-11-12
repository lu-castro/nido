'use strict';

// ---------- Datos ----------
// Nido guarda todo aparte de "Mis Gastos" (que sigue funcionando sola, en su propio repo).
// La primera vez que abrís Nido, copia lo que tenías en Mis Gastos en ese dispositivo.
const STORE_KEY = 'nido-data-v1';
const GH_KEY = 'nido-github-v1';
const GIST_FILE = 'nido.json';
const GIST_DESC = 'Backup app Nido';
const OLD_STORE_KEY = 'gastos-data-v1';
const OLD_GH_KEY = 'gastos-github-v1';
const APP_VERSION = '7';
const LISTAS_VIDA = ['tramites', 'turnos', 'proyectos', 'tareas'];

const DEFAULT_CATS = ['ALIMENTO', 'SERVICIO', 'SALUD', 'TRANSPORTE', 'HOGAR', 'OCIO', 'ESTÉTICA', 'REGALO', 'MONOTRIBUTO', 'OTRO'];
const PALETTE = ['#1f7a5a', '#2f6fb5', '#c0392b', '#d98c1f', '#7b4fb0', '#16a2a6', '#c2457a', '#6b8e23', '#8a6d3b', '#5f6b73', '#e05d2b', '#3d5a99'];

function emptyData() {
  return {
    version: 1,
    categorias: DEFAULT_CATS.slice(),
    meses: {},
    ahorros: [
      { id: uid(), nombre: 'USD', monto: 0, moneda: 'USD' },
      { id: uid(), nombre: 'LEMON', monto: 0, moneda: 'USD' },
      { id: uid(), nombre: 'UPWORK', monto: 0, moneda: 'USD' },
    ],
    borrados: {},
    catsMod: 0,
    config: {},
    informes: {},
    pasos: [],
    tramites: [],
    turnos: [],
    proyectos: [],
    tareas: [],
    updatedAt: 0,
  };
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    // Primera vez: traer una copia de lo que había en Mis Gastos (la app vieja no se toca).
    const viejo = localStorage.getItem(OLD_STORE_KEY);
    if (viejo) {
      const d = normalize(JSON.parse(viejo));
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
      // Reusar el token de GitHub de este dispositivo; Nido crea su propio backup aparte.
      const gh = JSON.parse(localStorage.getItem(OLD_GH_KEY) || '{}');
      if (gh.token && !localStorage.getItem(GH_KEY)) localStorage.setItem(GH_KEY, JSON.stringify({ token: gh.token, gistId: '' }));
      return d;
    }
  } catch (e) { /* datos corruptos o storage bloqueado */ }
  return emptyData();
}

function normalize(d) {
  const base = emptyData();
  return {
    version: 1,
    categorias: Array.isArray(d.categorias) && d.categorias.length ? d.categorias : base.categorias,
    meses: d.meses && typeof d.meses === 'object' ? d.meses : {},
    ahorros: Array.isArray(d.ahorros) ? d.ahorros : base.ahorros,
    borrados: d.borrados && typeof d.borrados === 'object' ? d.borrados : {},
    catsMod: Number(d.catsMod) || 0,
    config: d.config && typeof d.config === 'object' ? d.config : {},
    informes: d.informes && typeof d.informes === 'object' ? d.informes : {},
    pasos: Array.isArray(d.pasos) ? d.pasos : [],
    ...Object.fromEntries(LISTAS_VIDA.map(k => [k, Array.isArray(d[k]) ? d[k] : []])),
    updatedAt: Number(d.updatedAt) || 0,
  };
}

// Combina los datos de dos dispositivos: se queda con la versión más nueva de cada
// gasto/ingreso/ahorro y respeta lo que se borró en cualquiera de los dos.
function mergeData(a, b) {
  const out = emptyData();
  out.borrados = { ...a.borrados };
  for (const [id, t] of Object.entries(b.borrados)) out.borrados[id] = Math.max(out.borrados[id] || 0, t);
  const pick = list => {
    const byId = new Map();
    for (const it of list) {
      if (out.borrados[it.id]) continue;
      const prev = byId.get(it.id);
      if (!prev || (it.mod || 0) > (prev.mod || 0)) byId.set(it.id, it);
    }
    return [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  };
  const flat = (src, field) => Object.entries(src.meses).flatMap(([k, m]) => (m[field] || []).map(it => ({ it, k })));
  const keyed = list => pick(list.map(({ it, k }) => ({ ...it, _mes: k })));

  const mes = k => out.meses[k] || (out.meses[k] = { ingresos: [], gastos: [], nota: '', notaMod: 0 });
  for (const k of new Set([...Object.keys(a.meses), ...Object.keys(b.meses)])) {
    const ma = a.meses[k], mb = b.meses[k];
    const src = !ma ? mb : !mb ? ma : (mb.notaMod || 0) > (ma.notaMod || 0) ? mb : ma;
    if (src.nota) Object.assign(mes(k), { nota: src.nota, notaMod: src.notaMod || 0 });
  }
  // Los gastos van al mes de su fecha (por si se movieron de mes en otro dispositivo)
  for (const g of keyed(flat(a, 'gastos').concat(flat(b, 'gastos')))) {
    const { _mes, ...rest } = g; mes(g.fecha ? g.fecha.slice(0, 7) : _mes).gastos.push(rest);
  }
  for (const i of keyed(flat(a, 'ingresos').concat(flat(b, 'ingresos')))) {
    const { _mes, ...rest } = i; mes(_mes).ingresos.push(rest);
  }
  out.ahorros = pick(a.ahorros.concat(b.ahorros));
  const cats = b.catsMod > a.catsMod ? b : a;
  out.categorias = cats.categorias.slice(); out.catsMod = cats.catsMod;
  out.config = { ...((b.config.configMod || 0) > (a.config.configMod || 0) ? b.config : a.config) };
  out.pasos = pick(a.pasos.concat(b.pasos));
  for (const k of LISTAS_VIDA) out[k] = pick(a[k].concat(b[k]));
  for (const k of [...new Set([...Object.keys(a.informes), ...Object.keys(b.informes)])].sort()) {
    const ia = a.informes[k], ib = b.informes[k];
    out.informes[k] = !ia ? ib : !ib ? ia : (ib.mod || 0) > (ia.mod || 0) ? ib : ia;
  }
  out.updatedAt = Math.max(a.updatedAt, b.updatedAt);
  return out;
}
const fingerprint = d => JSON.stringify({ ...d, updatedAt: 0 });

let data = loadLocal();
let current = monthKey(new Date());

function persistLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { toast('No se pudo guardar en el celu'); }
}
function save({ sync = true } = {}) {
  data.updatedAt = Date.now();
  persistLocal();
  if (sync) schedulePush();
  render();
}
function markDeleted(id) { data.borrados[id] = Date.now(); }

function month(key = current) {
  if (!data.meses[key]) data.meses[key] = { ingresos: [], gastos: [], nota: '', notaMod: 0 };
  return data.meses[key];
}
function peekMonth(key) { return data.meses[key] || { ingresos: [], gastos: [], nota: '', notaMod: 0 }; }

// ---------- Fechas y números ----------
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
function daysInMonth(key) { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function monthName(key) {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function defaultDateFor(key) { return monthKey(new Date()) === key ? todayISO() : key + '-01'; }
function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (iso === todayISO()) return 'Hoy';
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
}

const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
function money(n, moneda = 'ARS') {
  if (moneda === 'USD') return 'US$ ' + fmtNum.format(n || 0);
  return fmtARS.format(Math.round(n || 0));
}

// Acepta "26.532,00", "11474,5", "420.000", "1500.50"
function parseMonto(s) {
  s = String(s || '').trim().replace(/[$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return parseFloat(s);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function catColor(cat) {
  const i = data.categorias.indexOf(cat);
  if (i >= 0) return PALETTE[i % PALETTE.length];
  let h = 0; for (const c of cat) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ---------- Cálculos ----------
function totals(key) {
  const m = peekMonth(key);
  const ingresosARS = m.ingresos.filter(i => i.moneda !== 'USD').reduce((a, i) => a + i.monto, 0);
  const ingresosUSD = m.ingresos.filter(i => i.moneda === 'USD').reduce((a, i) => a + i.monto, 0);
  const gastado = m.gastos.reduce((a, g) => a + g.monto, 0);
  const restante = ingresosARS - gastado;

  const nowKey = monthKey(new Date());
  const dim = daysInMonth(key);
  let transcurridos, quedan;
  if (key < nowKey) { transcurridos = dim; quedan = 0; }
  else if (key > nowKey) { transcurridos = 0; quedan = dim; }
  else { transcurridos = new Date().getDate(); quedan = dim - transcurridos + 1; }

  return {
    ingresosARS, ingresosUSD, gastado, restante,
    porDia: transcurridos ? gastado / transcurridos : 0,
    disponibleDia: quedan ? Math.max(restante, 0) / quedan : null,
  };
}

// ---------- Render ----------
const $ = sel => document.querySelector(sel);
const FIN_VIEWS = ['gastos', 'resumen', 'ingresos', 'ahorro'];
const TITULOS = { inicio: 'Nido', tramites: 'Trámites', turnos: 'Turnos médicos', proyectos: 'Proyectos', ajustes: 'Ajustes' };
let view = 'inicio', ultimaFin = 'gastos';

function render() {
  const esFin = FIN_VIEWS.includes(view);
  $('#prevMonth').hidden = $('#nextMonth').hidden = $('#finTabs').hidden = !esFin;
  $('.top').classList.toggle('plano', !esFin);
  $('#monthTitle').textContent = esFin ? monthName(current) : TITULOS[view];
  const t = totals(current);
  const m = peekMonth(current);

  // Resumen
  const rest = $('#sumRestante');
  rest.textContent = money(t.restante);
  rest.classList.toggle('neg', t.restante < 0);
  $('#sumIngresos').innerHTML = money(t.ingresosARS) + (t.ingresosUSD ? '<small class="usd">+ ' + money(t.ingresosUSD, 'USD') + '</small>' : '');
  $('#sumGastado').textContent = money(t.gastado);
  $('#sumPorDia').textContent = money(t.porDia);
  $('#sumDisponibleDia').textContent = t.disponibleDia === null ? '—' : money(t.disponibleDia);
  const pct = t.ingresosARS ? Math.min(100, (t.gastado / t.ingresosARS) * 100) : (t.gastado ? 100 : 0);
  const bar = $('#sumBar');
  bar.style.width = pct + '%';
  bar.classList.toggle('warn', pct >= 80 && pct < 100);
  bar.classList.toggle('over', pct >= 100);

  const note = $('#monthNote');
  if (document.activeElement !== note) note.value = m.nota || '';
  autoGrow(note);

  renderGastos(m, t);
  if (view === 'resumen') renderResumen(m, t);
  if (view === 'ingresos') renderIngresos(m);
  if (view === 'ahorro') renderAhorro();
  if (view === 'ajustes') renderAjustes();
  if (view === 'inicio') renderInicio();
  if (view === 'tramites') renderTramites();
  if (view === 'turnos') renderTurnos();
  if (view === 'proyectos') renderProyectos();
  actualizarAviso();
}

function renderGastos(m, t) {
  const box = $('#gastosList');
  if (!m.gastos.length) {
    box.innerHTML = `<div class="empty">Todavía no cargaste gastos este mes.<br>Tocá <b>+</b> para agregar uno.${
      !m.ingresos.length ? '<br><br>Tip: cargá primero tus ingresos en la pestaña <b>Ingresos</b>.' : ''}</div>`;
    return;
  }
  // Saldo restante después de cada gasto (como la columna "SALARIO FINAL")
  const asc = m.gastos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado);
  let saldo = t.ingresosARS;
  const saldoDespues = {};
  for (const g of asc) { saldo -= g.monto; saldoDespues[g.id] = saldo; }

  let html = '', lastDay = '';
  for (const g of asc.reverse()) {
    if (g.fecha !== lastDay) {
      const dayTotal = m.gastos.filter(x => x.fecha === g.fecha).reduce((a, x) => a + x.monto, 0);
      html += `<div class="day-group">${esc(dayLabel(g.fecha))} · ${money(dayTotal)}</div>`;
      lastDay = g.fecha;
    }
    const color = catColor(g.categoria);
    html += `<button class="item" data-gasto="${g.id}">
      <span class="dot" style="background:${color}">${esc(g.categoria.slice(0, 2))}</span>
      <span class="mid">
        <div class="t">${esc(g.nota || g.categoria)}${g.fijo ? '<span class="badge">fijo</span>' : ''}</div>
        <div class="s">${esc(g.categoria)}</div>
      </span>
      <span class="amt">${money(g.monto)}<small>quedan ${money(saldoDespues[g.id])}</small></span>
    </button>`;
  }
  box.innerHTML = html;
}

function renderResumen(m, t) {
  const byCat = {};
  for (const g of m.gastos) byCat[g.categoria] = (byCat[g.categoria] || 0) + g.monto;
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  $('#catBreakdown').innerHTML = rows.length ? rows.map(([cat, v]) => {
    const pct = t.gastado ? (v / t.gastado) * 100 : 0;
    return `<div class="cat-row">
      <div class="h"><span>${esc(cat)}</span><span><b>${money(v)}</b> · ${Math.round(pct)}%</span></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${catColor(cat)}"></div></div>
    </div>`;
  }).join('') : '<p class="muted">Sin gastos este mes.</p>';

  const keys = [];
  for (let i = 0; i < 12; i++) {
    const k = shiftMonth(current, -i), mm = peekMonth(k);
    if (mm.gastos.length || mm.ingresos.length) keys.push(k);
  }
  $('#monthsHistory').innerHTML = keys.length ? keys.map(k => {
    const tt = totals(k);
    return `<div class="hist-row"><span>${esc(monthName(k))}<small>Gastado ${money(tt.gastado)}</small></span><b class="${tt.restante < 0 ? 'neg' : ''}">${money(tt.restante)}</b></div>`;
  }).join('') : '<p class="muted">Todavía no hay meses con datos.</p>';
  renderPlanInformes();
}

function renderIngresos(m) {
  $('#ingresosList').innerHTML = m.ingresos.length ? m.ingresos.map(i =>
    `<div class="line-item" data-ingreso="${i.id}"><span>${esc(i.fuente)}</span><b>${money(i.monto, i.moneda)}</b></div>`
  ).join('') : '<p class="muted">Sin ingresos cargados para este mes.</p>';
}

function renderAhorro() {
  const usd = data.ahorros.filter(a => a.moneda === 'USD').reduce((s, a) => s + a.monto, 0);
  const ars = data.ahorros.filter(a => a.moneda !== 'USD').reduce((s, a) => s + a.monto, 0);
  $('#ahorroTotal').textContent = money(usd, 'USD');
  $('#ahorroOtras').textContent = ars ? 'Además: ' + money(ars) + ' en pesos' : '';
  $('#ahorrosList').innerHTML = data.ahorros.length ? data.ahorros.map(a =>
    `<div class="line-item" data-ahorro="${a.id}"><span>${esc(a.nombre)}</span><b>${money(a.monto, a.moneda)}</b></div>`
  ).join('') : '<p class="muted">Sin cuentas de ahorro.</p>';
}

function renderAjustes() {
  $('#catsEdit').innerHTML = data.categorias.map(c =>
    `<button class="chip" data-delcat="${esc(c)}">${esc(c)}<span class="x">✕</span></button>`
  ).join('');
  const gh = ghConfig();
  if (document.activeElement !== $('#ghToken')) $('#ghToken').value = gh.token || '';
  if (document.activeElement !== $('#ghGist')) $('#ghGist').value = gh.gistId || '';
  $('#ghInfo').textContent = 'Versión de la app: ' + APP_VERSION +
    (gh.gistId ? ' · Código de tu backup: ' + gh.gistId.slice(-5).toUpperCase() : ' · Sin conectar');
  renderAjustesAsesor();
}

function autoGrow(el) {
  el.style.height = 'auto';
  if (el.value && el.offsetParent) el.style.height = el.scrollHeight + 'px';
}
window.addEventListener('resize', () => autoGrow($('#monthNote')));

function setView(v) {
  if (v === 'finanzas') v = ultimaFin;
  if (FIN_VIEWS.includes(v)) ultimaFin = v;
  view = v;
  document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active',
    b.dataset.view === v || (b.dataset.view === 'finanzas' && FIN_VIEWS.includes(v))));
  document.querySelectorAll('#finTabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#fab').hidden = !['gastos', 'resumen', 'inicio', 'tramites', 'turnos', 'proyectos'].includes(v);
  $('#fab').setAttribute('aria-label', { tramites: 'Nuevo trámite', turnos: 'Nuevo turno', proyectos: 'Nuevo proyecto', inicio: 'Agregar' }[v] || 'Cargar gasto');
  render();
  window.scrollTo(0, 0);
}

// ---------- Hoja de edición ----------
let sheetSubmit = null, sheetDel = null;

function openSheet({ title, body, onSubmit, onDelete, focus, sinBotones = false }) {
  ocultarSnack();
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = body;
  $('#sheetActions').hidden = sinBotones;
  sheetSubmit = onSubmit; sheetDel = onDelete;
  $('#sheetDelete').hidden = !onDelete;
  $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
  if (focus) setTimeout(() => { const el = $(focus); if (el) el.focus(); }, 50);
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; sheetSubmit = sheetDel = null; }

function catChips(selected) {
  return `<div class="chips" id="catChips">${data.categorias.map(c =>
    `<button type="button" class="chip${c === selected ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
}
function selectedCat() { const on = document.querySelector('#catChips .chip.on'); return on ? on.dataset.cat : null; }

function gastoSheet(g) {
  const isNew = !g;
  g = g || { fecha: defaultDateFor(current), categoria: data.categorias[0], monto: '', nota: '', fijo: false };
  openSheet({
    title: isNew ? 'Nuevo gasto' : 'Editar gasto',
    focus: isNew ? '#fMonto' : null,
    body: `
      <input id="fMonto" class="amount-input" type="text" inputmode="decimal" placeholder="$ 0" value="${g.monto === '' ? '' : esc(fmtNum.format(g.monto))}">
      <span class="label">Motivo</span>${catChips(g.categoria)}
      <label class="label" for="fNota">Nota</label>
      <input id="fNota" type="text" placeholder="Ej: alquiler, comida, SUBE..." value="${esc(g.nota)}">
      <label class="label" for="fFecha">Fecha</label>
      <input id="fFecha" type="date" value="${esc(g.fecha)}">
      <label class="check"><input id="fFijo" type="checkbox" ${g.fijo ? 'checked' : ''}> Gasto fijo (se repite todos los meses)</label>`,
    onSubmit() {
      const monto = parseMonto($('#fMonto').value);
      if (!(monto > 0)) return toast('Poné un monto válido');
      const fecha = $('#fFecha').value || defaultDateFor(current);
      const item = {
        id: g.id || uid(), creado: g.creado || Date.now(), mod: Date.now(),
        fecha, categoria: selectedCat() || 'OTRO', monto,
        nota: $('#fNota').value.trim(), fijo: $('#fFijo').checked,
      };
      // Si cambió la fecha a otro mes, mover el gasto a ese mes
      if (!isNew) removeGasto(g.id);
      const key = fecha.slice(0, 7);
      month(key).gastos.push(item);
      if (key !== current) { current = key; toast('Guardado en ' + monthName(key)); }
      else toast(isNew ? 'Gasto cargado' : 'Gasto actualizado');
      closeSheet(); save();
      if (isNew) guardarComentario(reaccionGasto(item));
    },
    onDelete: isNew ? null : () => {
      if (!confirm('¿Borrar este gasto?')) return;
      removeGasto(g.id); markDeleted(g.id); closeSheet(); save(); toast('Gasto borrado');
    },
  });
}
function removeGasto(id) {
  for (const k in data.meses) data.meses[k].gastos = data.meses[k].gastos.filter(x => x.id !== id);
}

function ingresoSheet(i) {
  const isNew = !i;
  i = i || { fuente: '', monto: '', moneda: 'ARS' };
  openSheet({
    title: isNew ? 'Nuevo ingreso' : 'Editar ingreso',
    focus: isNew ? '#iFuente' : null,
    body: `
      <label class="label" for="iFuente">De dónde viene</label>
      <input id="iFuente" type="text" placeholder="Ej: 20DEDOS, ALEXDATA, OESTE B" value="${esc(i.fuente)}">
      <label class="label" for="iMonto">Monto</label>
      <input id="iMonto" type="text" inputmode="decimal" placeholder="0" value="${i.monto === '' ? '' : esc(fmtNum.format(i.monto))}">
      <label class="label" for="iMoneda">Moneda</label>
      <select id="iMoneda"><option value="ARS"${i.moneda !== 'USD' ? ' selected' : ''}>Pesos</option><option value="USD"${i.moneda === 'USD' ? ' selected' : ''}>Dólares</option></select>`,
    onSubmit() {
      const monto = parseMonto($('#iMonto').value);
      const fuente = $('#iFuente').value.trim();
      if (!fuente) return toast('Poné de dónde viene');
      if (!(monto >= 0)) return toast('Poné un monto válido');
      const m = month();
      const item = { id: i.id || uid(), mod: Date.now(), fuente, monto, moneda: $('#iMoneda').value };
      const idx = m.ingresos.findIndex(x => x.id === item.id);
      if (idx >= 0) m.ingresos[idx] = item; else m.ingresos.push(item);
      closeSheet(); save();
    },
    onDelete: isNew ? null : () => {
      if (!confirm('¿Borrar este ingreso?')) return;
      const m = month(); m.ingresos = m.ingresos.filter(x => x.id !== i.id); markDeleted(i.id); closeSheet(); save();
    },
  });
}

function ahorroSheet(a) {
  const isNew = !a;
  a = a || { nombre: '', monto: '', moneda: 'USD' };
  openSheet({
    title: isNew ? 'Nueva cuenta de ahorro' : 'Actualizar ahorro',
    focus: isNew ? '#aNombre' : '#aMonto',
    body: `
      <label class="label" for="aNombre">Nombre</label>
      <input id="aNombre" type="text" placeholder="Ej: LEMON, UPWORK, colchón" value="${esc(a.nombre)}">
      <label class="label" for="aMonto">Monto actual</label>
      <input id="aMonto" type="text" inputmode="decimal" placeholder="0" value="${a.monto === '' ? '' : esc(fmtNum.format(a.monto))}">
      <label class="label" for="aMoneda">Moneda</label>
      <select id="aMoneda"><option value="USD"${a.moneda === 'USD' ? ' selected' : ''}>Dólares</option><option value="ARS"${a.moneda !== 'USD' ? ' selected' : ''}>Pesos</option></select>`,
    onSubmit() {
      const monto = parseMonto($('#aMonto').value);
      const nombre = $('#aNombre').value.trim();
      if (!nombre) return toast('Poné un nombre');
      if (!(monto >= 0)) return toast('Poné un monto válido');
      const item = { id: a.id || uid(), mod: Date.now(), nombre, monto, moneda: $('#aMoneda').value };
      const idx = data.ahorros.findIndex(x => x.id === item.id);
      if (idx >= 0) data.ahorros[idx] = item; else data.ahorros.push(item);
      closeSheet(); save();
    },
    onDelete: isNew ? null : () => {
      if (!confirm('¿Borrar esta cuenta?')) return;
      data.ahorros = data.ahorros.filter(x => x.id !== a.id); markDeleted(a.id); closeSheet(); save();
    },
  });
}

// ---------- Copiar del mes anterior ----------
function copyIngresos() {
  const prev = peekMonth(shiftMonth(current, -1));
  if (!prev.ingresos.length) return toast('El mes anterior no tiene ingresos');
  const m = month();
  for (const i of prev.ingresos) m.ingresos.push({ ...i, id: uid(), mod: Date.now() });
  save(); toast('Ingresos copiados: revisá los montos');
}
function copyFijos() {
  const prevKey = shiftMonth(current, -1);
  const fijos = peekMonth(prevKey).gastos.filter(g => g.fijo);
  if (!fijos.length) return toast('No hay gastos fijos en el mes anterior');
  const m = month();
  const dim = daysInMonth(current);
  for (const g of fijos) {
    const day = Math.min(Number(g.fecha.slice(8, 10)), dim);
    m.gastos.push({ ...g, id: uid(), creado: Date.now(), mod: Date.now(), fecha: current + '-' + String(day).padStart(2, '0') });
  }
  save(); toast(fijos.length + ' gastos fijos copiados');
}

// ---------- Exportar / importar ----------
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const m = peekMonth(current);
  const t = totals(current);
  const num = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const lines = ['INGRESOS', 'Fuente;Moneda;Monto'];
  for (const i of m.ingresos) lines.push([q(i.fuente), i.moneda, num(i.monto)].join(';'));
  lines.push('', 'GASTOS', 'Fecha;Motivo;Monto;Nota;Fijo;Saldo restante');
  let saldo = t.ingresosARS;
  for (const g of m.gastos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado)) {
    saldo -= g.monto;
    lines.push([g.fecha, q(g.categoria), num(g.monto), q(g.nota), g.fijo ? 'SI' : '', num(saldo)].join(';'));
  }
  lines.push('', 'Gasto total;' + num(t.gastado), 'Te queda;' + num(t.restante), 'Gasto x día;' + num(t.porDia));
  if (m.nota) lines.push('Nota;' + q(m.nota));
  download('gastos-' + current + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJson() {
  download('nido-backup-' + todayISO() + '.json', JSON.stringify(data, null, 2), 'application/json');
}
function importJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = normalize(JSON.parse(r.result));
      if (!confirm('Esto reemplaza todos los datos del celu por los del archivo. ¿Seguir?')) return;
      data = d; save(); toast('Backup importado');
    } catch (e) { toast('Ese archivo no es un backup válido'); }
  };
  r.readAsText(file);
}

// ---------- Sincronización con GitHub (Gist secreto) ----------
function ghConfig() { try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch (e) { return {}; } }
function setGhConfig(c) { try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } }
function ghStatus(msg) { $('#ghStatus').textContent = msg; }

async function gh(path, opts = {}) {
  const { token } = ghConfig();
  const res = await fetch('https://api.github.com' + path, {
    ...opts,
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = new Error('GitHub ' + res.status);
    err.status = res.status; throw err;
  }
  return res.json();
}

async function pullGist(gistId) {
  const gist = await gh('/gists/' + gistId);
  const f = gist.files && gist.files[GIST_FILE];
  if (!f) return null;
  const content = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return normalize(JSON.parse(content));
}

// Si cada dispositivo creó su propio backup, los junta todos en el más viejo
// y deja a este dispositivo usando ese. Así compu y celu terminan en el mismo.
async function unificarGists(c) {
  const gists = await gh('/gists?per_page=100');
  const mios = gists.filter(g => g.description === GIST_DESC && g.files && g.files[GIST_FILE])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!mios.length) return;
  const principal = mios[0].id;
  for (const g of mios.slice(1)) {
    const otro = await pullGist(g.id);
    if (otro) data = mergeData(data, otro);
  }
  if (c.gistId !== principal) {
    c.gistId = principal; setGhConfig(c);
    if (view === 'ajustes') renderAjustes();
  }
}

let pushTimer = null, syncing = false, pendingPush = false, unificado = false;
function schedulePush() {
  if (!ghConfig().token) return;
  pendingPush = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 1500);
}

// Baja lo que hay en GitHub, lo combina con lo de este dispositivo y sube el resultado.
async function syncNow() {
  const c = ghConfig();
  if (!c.token) return;
  if (syncing) { pendingPush = true; return; }
  if (!navigator.onLine) { ghStatus('Sin conexión: se sincroniza cuando vuelva internet.'); return; }
  syncing = true; pendingPush = false;
  let failed = false;
  try {
    const before = fingerprint(data);
    // Al abrir la app (y al conectar): encontrar el backup compartido y juntar duplicados
    if (!c.gistId || !unificado) { await unificarGists(c); unificado = true; }
    const remote = c.gistId ? await pullGist(c.gistId) : null;
    if (remote) data = mergeData(data, remote);
    if (fingerprint(data) !== before) { persistLocal(); checkInformes(); render(); }
    const content = JSON.stringify(data);
    const body = { files: { [GIST_FILE]: { content } } };
    if (!c.gistId) {
      const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ ...body, public: false, description: GIST_DESC }) });
      setGhConfig({ ...c, gistId: g.id });
      if (view === 'ajustes') renderAjustes();
    } else if (!remote || fingerprint(mergeData(remote, remote)) !== fingerprint(data)) {
      await gh('/gists/' + c.gistId, { method: 'PATCH', body: JSON.stringify(body) });
    }
    ghStatus('✓ Sincronizado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    pendingPush = true; failed = true;
    ghStatus(e.status === 401 ? 'El token no es válido o venció.'
      : e.status === 404 ? 'No encontré ese Gist. Revisá el ID.'
      : 'No se pudo sincronizar (' + (e.status || 'sin red') + '). Reintento después.');
  } finally {
    syncing = false;
    // Si se cargó algo mientras sincronizaba, subirlo. Si falló, reintenta al minuto o al volver internet.
    if (pendingPush && !failed) schedulePush();
  }
}

async function connectGithub() {
  const token = $('#ghToken').value.trim();
  const gistId = $('#ghGist').value.trim().replace(/^.*\//, '');
  if (!token) return toast('Pegá tu token de GitHub');
  setGhConfig({ token, gistId });
  ghStatus('Conectando…');
  unificado = false;
  await syncNow();
}

// ---------- Eventos ----------
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}

$('#prevMonth').onclick = () => { current = shiftMonth(current, -1); render(); };
$('#nextMonth').onclick = () => { current = shiftMonth(current, 1); render(); };
document.querySelectorAll('.tabs button, #finTabs button').forEach(b => { b.onclick = () => setView(b.dataset.view); });
$('#openAjustes').onclick = () => setView('ajustes');
$('#fab').onclick = () => {
  if (view === 'inicio') return menuNuevo();
  if (view === 'tramites') return tramiteSheet();
  if (view === 'turnos') return turnoSheet();
  if (view === 'proyectos') return proyectoSheet();
  gastoSheet();
};

$('#gastosList').onclick = e => {
  const el = e.target.closest('[data-gasto]'); if (!el) return;
  const g = peekMonth(current).gastos.find(x => x.id === el.dataset.gasto);
  if (g) gastoSheet(g);
};
$('#ingresosList').onclick = e => {
  const el = e.target.closest('[data-ingreso]'); if (!el) return;
  const i = peekMonth(current).ingresos.find(x => x.id === el.dataset.ingreso);
  if (i) ingresoSheet(i);
};
$('#ahorrosList').onclick = e => {
  const el = e.target.closest('[data-ahorro]'); if (!el) return;
  const a = data.ahorros.find(x => x.id === el.dataset.ahorro);
  if (a) ahorroSheet(a);
};
$('#addIngreso').onclick = () => ingresoSheet();
$('#addAhorro').onclick = () => ahorroSheet();
$('#copyIngresos').onclick = copyIngresos;
$('#copyFijos').onclick = copyFijos;

let noteTimer;
$('#monthNote').oninput = e => {
  autoGrow(e.target);
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { Object.assign(month(), { nota: e.target.value, notaMod: Date.now() }); save(); }, 600);
};

$('#sheet').onsubmit = e => { e.preventDefault(); if (sheetSubmit) sheetSubmit(); };
$('#sheetCancel').onclick = closeSheet;
$('#sheetBackdrop').onclick = closeSheet;
$('#sheetDelete').onclick = () => { if (sheetDel) sheetDel(); };
$('#sheetBody').onclick = e => {
  const chip = e.target.closest('#catChips .chip'); if (!chip) return;
  document.querySelectorAll('#catChips .chip').forEach(c => c.classList.toggle('on', c === chip));
};

$('#addCat').onclick = () => {
  const v = $('#newCat').value.trim().toUpperCase();
  if (!v) return;
  if (data.categorias.includes(v)) return toast('Esa categoría ya existe');
  data.categorias.push(v); data.catsMod = Date.now(); $('#newCat').value = ''; save();
};
$('#catsEdit').onclick = e => {
  const el = e.target.closest('[data-delcat]'); if (!el) return;
  const c = el.dataset.delcat;
  if (data.categorias.length <= 1) return toast('Tiene que quedar al menos una');
  if (!confirm('¿Sacar la categoría "' + c + '"? Los gastos ya cargados la conservan.')) return;
  data.categorias = data.categorias.filter(x => x !== c); data.catsMod = Date.now(); save();
};

$('#ghSave').onclick = connectGithub;
$('#ghSyncNow').onclick = () => {
  if (!ghConfig().token) return toast('Primero conectá tu token');
  ghStatus('Sincronizando…'); unificado = false; syncNow();
};
$('#ghDisconnect').onclick = () => {
  if (!confirm('¿Desconectar GitHub en este celu? Tus datos siguen acá y en el Gist.')) return;
  setGhConfig({}); renderAjustes(); ghStatus('Desconectado.');
};
$('#exportCsv').onclick = exportCsv;
$('#exportJson').onclick = exportJson;
$('#importJson').onchange = e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };

window.addEventListener('online', syncNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { render(); syncNow(); }
});
// Mientras la app está abierta, trae cada minuto lo cargado en el otro dispositivo
setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);

// ---------- Inicio ----------
initVida();
setView('inicio');
initAsesor();
// Antes de que hable el estratega, esperar (un poco) a tener los datos del otro dispositivo
Promise.race([syncNow(), new Promise(r => setTimeout(r, 2500))]).then(() => {
  checkInformes();
  saludarSiCorresponde();
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
