// Componentes comunes SIN internet (v0.4): datos de evaluación en bloques opacos, emisión de códigos (solo Administración), resultados.
import * as C from './crypto.js'; import * as P from './protocol.js'; import * as DB from './db.js';
import { h, btn, card, toast, copy, download, fmtDT, T, toLocalInput, fromLocalInput, table, field, readFile, readText } from './util.js'; import { qrBox, escanear } from './qr.js'; import { exportXlsx } from './xlsxout.js'; import { TIPOS } from './integrity.js';

// ---- datos de evaluación: bloques uniformes con nombre aleatorio (d/<nombre>.bin) ----
export const CACHE_D = 'eo-d';
const okName = n => /^[0-9a-f]{24}$/.test(n);
export async function manifiesto() {
  try { const r = await fetch('d/m.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.ch)) { await DB.put('kv', 'm', j); return j; } } } catch { }
  return (await DB.get('kv', 'm')) || { ch: [] };
}
async function chunk(name) {
  if (!okName(name)) return null;
  const l = await DB.get('d', name); if (l) return l;
  try { const m = await (await caches.open(CACHE_D)).match('d/' + name + '.bin'); if (m) return new Uint8Array(await m.arrayBuffer()); } catch { }
  try { const r = await fetch('d/' + name + '.bin'); if (r.ok) { const u = new Uint8Array(await r.arrayBuffer()); if (u.length === C.CH) { try { await (await caches.open(CACHE_D)).put('d/' + name + '.bin', new Response(u)); } catch { } return u; } } } catch { }
  return null;
}
export async function getChunks(names) { const out = []; for (const n of names) { const c = await chunk(n); if (!c) return null; out.push(c); } return out; }
export async function prepararSinInternet(progress) {
  const m = await manifiesto(); if (!m.ch.length) return { ok: 0, n: 0 };
  const c = await caches.open(CACHE_D); let ok = 0, i = 0;
  for (const n of m.ch) { i++; progress && progress(i, m.ch.length); try { if (await c.match('d/' + n + '.bin')) { ok++; continue; } const r = await fetch('d/' + n + '.bin'); if (r.ok) { await c.put('d/' + n + '.bin', r); ok++; } } catch { } }
  return { ok, n: m.ch.length };
}
export async function importarDatos(files) { // .evd (sin internet): solo guarda bloques; no sabe a qué forma pertenecen
  let n = 0;
  for (const f of files) { try { for (const [name, b] of C.unpackEVD(await readFile(f))) { if (!(await DB.get('d', name))) { await DB.put('d', name, b); n++; } } } catch { toast(T('Archivo de datos inválido: ', 'Invalid exam data file: ') + f.name); } }
  return n;
}
export async function exportarDatos(progress) { // todos los bloques públicos + los importados en este dispositivo
  const m = await manifiesto(), names = [...new Set([...m.ch, ...(await DB.all('d')).map(x => x[0])])], out = []; let i = 0;
  for (const n of names) { i++; progress && progress(i, names.length); const c = await chunk(n); if (c) out.push([n, c]); }
  return { blob: C.packEVD(out), n: out.length, total: names.length };
}
export function datosUI(titulo = 'Datos de evaluación (cifrados)') {
  const st = h('p', { class: 'mini' });
  return card(h('h3', null, titulo), h('p', { class: 'mini' }, 'Todos los archivos miden lo mismo y tienen nombres aleatorios: guardarlos no revela qué formas existen ni cuál se aplicará. Descárgalos con internet antes del examen para usar la app sin conexión.'),
    h('div', { class: 'row' }, btn('Preparar datos para uso sin internet', async () => { const r = await prepararSinInternet((i, t) => st.textContent = `Descargando ${i}/${t}…`); st.textContent = r.n ? `Listo: ${r.ok} de ${r.n} bloques guardados.` : 'Sin conexión: no se pudo leer la lista de datos.'; }),
      btn('Descargar archivo de datos (.evd)', async () => { st.textContent = 'Preparando…'; const r = await exportarDatos((i, t) => st.textContent = `Preparando ${i}/${t}…`); if (!r.n) return st.textContent = 'No hay datos en este dispositivo.'; download('datos_evaluacion.evd', r.blob); st.textContent = `Archivo con ${r.n} bloques.`; }, 'ghost'),
      h('label', { class: 'btn ghost' }, 'Importar archivo de datos (.evd)', h('input', { type: 'file', multiple: true, hidden: true, accept: '.evd', onchange: async e => toast((await importarDatos(e.target.files)) + ' bloques nuevos') }))), st);
}

export function tokenBox(token, label, fname) {
  return h('div', null, h('p', { class: 'mini' }, label), h('textarea', { class: 'tok', readonly: true, rows: 4 }, token),
    h('div', { class: 'row' }, btn(T('Copiar', 'Copy'), () => copy(token), 'sm'), btn(T('Descargar .txt', 'Download .txt'), () => download(fname || 'codigo.txt', token, 'text/plain'), 'sm ghost')), qrBox(token));
}
export function pasteScan(label, cb, hint) { // entrada de texto + cámara + archivo
  const ta = h('textarea', { class: 'tok', rows: 3, placeholder: hint || 'Pega aquí el código' });
  return h('div', null, h('label', null, label, ta), h('div', { class: 'row' }, btn('Escanear QR', () => escanear(t => { ta.value = t; cb(t); }).catch(e => toast(e.message)), 'sm ghost'), btn('Usar código', () => cb(ta.value), 'sm')));
}

// ---- emisión de códigos de evaluación (SOLO la Administración) ----
// formas: [{s, ti, clase, ck, ch, n, du}] aprobadas; apls: [{id, nm, pk, bk, nb, ex}] aplicadores vigentes.
export function emitirEval(adm, formas, apls, after) {
  const now = P.now(), out = h('div');
  const ty = h('select', null, Object.entries(P.TIPOS_EVAL).map(([k, v]) => h('option', { value: k }, v.es)));
  const pa = h('select', null, [['1', '1.ª parcial'], ['2', '2.ª parcial'], ['3', '3.ª parcial']].map(([v, l]) => h('option', { value: v }, l)));
  const fm = h('select'), paL = field('Número de evaluación parcial', pa);
  const nb = h('input', { type: 'datetime-local', value: toLocalInput(now) }), ex = h('input', { type: 'datetime-local', value: toLocalInput(now + 4 * 3600) }),
    du = h('input', { type: 'number', min: 5, max: 240, value: 45 }), pl = h('input', { type: 'number', min: 1, max: 5, value: 2 });
  const ap = h('select', null, h('option', { value: '' }, 'Ninguno (resultados solo para la Administración)'), apls.map(a => h('option', { value: a.id }, `${a.nm} · vigente hasta ${fmtDT(a.ex)}`)));
  const fill = () => { const cl = P.TIPOS_EVAL[ty.value].clase, fs = formas.filter(f => f.clase === cl); fm.replaceChildren(...(fs.length ? fs.map(f => h('option', { value: f.s }, f.ti)) : [h('option', { value: '' }, `No hay formas ${cl} aprobadas`)])); paL.style.display = ty.value === 'ALC_P' ? '' : 'none'; const f = fs[0]; du.value = f?.du || (cl === 'ALC' ? 45 : 100); };
  ty.onchange = fill; fm.onchange = () => { const f = formas.find(x => x.s === fm.value); if (f) du.value = f.du || du.value; }; fill();
  const go = async () => {
    try {
      const f = formas.find(x => x.s === fm.value); if (!f) return toast('Elige una forma aprobada.');
      if (f.clase !== P.TIPOS_EVAL[ty.value].clase) return toast('Esa forma no corresponde al tipo de evaluación.');
      const nbv = fromLocalInput(nb.value), exv = fromLocalInput(ex.value);
      if (!(exv > nbv)) return toast('La vigencia termina antes de empezar.'); if (exv - nbv > 24 * 3600) return toast('La vigencia máxima es de 24 horas.');
      const a = apls.find(x => x.id === ap.value) || null; if (a && (nbv < a.nb || exv > a.ex)) return toast('El código de ese aplicador no cubre esa vigencia.');
      const r = await P.issueEval(adm, { ty: ty.value, pa: +pa.value, form: { s: f.s, ck: f.ck, ch: f.ch, n: f.n }, nb: nbv, ex: exv, du: +du.value, pl: +pl.value, apl: a });
      const lab = P.etiquetaES(ty.value, ty.value === 'ALC_P' ? +pa.value : null);
      await DB.put('emitidos', r.id, { id: r.id, token: r.token, pin: r.pin, s: f.s, ti: f.ti, ty: ty.value, pa: r.body.pa, nb: nbv, ex: exv, du: +du.value, pl: +pl.value, ap: a ? a.nm : null, ts: Date.now() });
      await DB.logEv('emitir_evaluacion', { id: r.id, ty: ty.value, s: f.s, nb: nbv, ex: exv, ap: a ? a.id : null });
      out.replaceChildren(card(h('h3', null, 'Código de evaluación emitido'), h('p', null, h('b', null, lab), ` · forma: ${f.ti} · vigente del ${fmtDT(nbv)} al ${fmtDT(exv)} · ${du.value} min`),
        h('p', { class: 'mini' }, 'El código NO dice qué forma es: la forma va cifrada con el PIN. El cadete solo verá el tipo de evaluación.'),
        tokenBox(r.token, 'PASO 1 · Código (puedes enviarlo antes; sin el PIN no abre nada ni revela la forma):', 'codigo_evaluacion.txt'),
        h('p', null, h('b', null, 'PASO 2 · PIN'), ' (díctalo o muéstralo SOLO en el momento del examen):'), h('div', { class: 'pin' }, C.fmtPin(r.pin))));
      after && after();
    } catch (e) { toast(e.message); }
  };
  return card(h('h3', null, 'Emitir código de evaluación'), h('p', { class: 'mini' }, 'Paso 1: tipo de evaluación. Paso 2: forma. Paso 3: ventana (inicio y fin). Cada código abre UNA forma, solo dentro de su ventana y con el PIN. Sin código de la Administración no se puede iniciar ningún examen.'),
    h('div', { class: 'g2' }, field('1 · Tipo de evaluación', ty), paL), field('2 · Forma (solo la ve la Administración)', fm),
    h('div', { class: 'g2' }, field('3 · Inicia', nb), field('Termina (vigencia del código)', ex)), h('div', { class: 'g2' }, field('Duración del examen (min)', du), field('Reproducciones por audio', pl)),
    field('Aplicador que recibe los resultados (opcional)', ap),
    btn('Generar código y PIN', go, 'big'), out);
}
export async function emitidosUI() {
  const rows = (await DB.all('emitidos')).map(x => x[1]).sort((a, b) => b.ts - a.ts); const t = P.now();
  return card(h('h3', null, 'Códigos emitidos en este dispositivo'), rows.length ? table(['Evaluación', 'Forma', 'Vigencia', 'Aplicador', 'Estado', 'PIN', ''], rows.map(r => [P.etiquetaES(r.ty, r.pa), r.ti || '—', `${fmtDT(r.nb)} → ${fmtDT(r.ex)}`, r.ap || '—', h('span', { class: 'pill ' + (t > r.ex ? 'bad' : t < r.nb ? 'warn' : 'ok') }, t > r.ex ? 'vencido' : t < r.nb ? 'programado' : 'vigente'),
    h('button', { class: 'btn sm ghost', onclick: e => { DB.logEv('ver_pin', { id: r.id }); e.target.textContent = C.fmtPin(r.pin); } }, 'Ver PIN'), h('button', { class: 'btn sm ghost', onclick: () => copy(r.token) }, 'Copiar código')])) : h('p', { class: 'mini' }, 'Aún no has emitido códigos.'));
}

// ---- resultados ----
// adm: {formas: ks.forms} solo en la Administración (ve la forma y califica). El aplicador ve resultados sin forma ni calificación.
export async function resultadosUI({ boxSk, issuerSk, titulo, adm }) {
  const root = h('div'); const emit = Object.fromEntries((await DB.all('emitidos')).map(x => [x[0], x[1]]));
  async function load() {
    const rs = (await DB.all('resultados')).map(x => x[1]); const rows = [];
    for (const rec of rs) {
      let r = null, ok = null, sc = null, fail = null, fo = null;
      try { r = P.openResult(rec.token, boxSk).r; } catch (e) { fail = e.message; }
      if (r) {
        const em = emit[r.ev]; if (em) { try { const kek = await C.kdf(em.pin, C.unb64(C.peekToken(em.token, 'EV2').sa), C.PIN_ITER, 'EV2|' + r.ev); ok = await P.checkMac(r, kek); } catch { ok = false; } }
        if (adm) { const x = P.formaDe(r, boxSk), f = x && adm.formas[x.s]; fo = f ? f.ti : (x ? 'forma desconocida' : '—'); if (f && f.k) { let a = 0; r.an.split('').forEach((c, i) => { if (c !== '-' && 'ABCD'.indexOf(c) === f.k[i]) a++; }); sc = { a, n: f.k.length }; } }
      }
      rows.push({ rec, r, ok, sc, fail, fo });
    }
    return rows;
  }
  async function draw() {
    const rows = await load(), good = rows.filter(x => x.r);
    const dup = {}; for (const x of good) { const k = x.r.ev + '|' + x.r.cad.mat.toUpperCase(); (dup[k] ||= []).push(x); }
    const add = async t => { const { env } = P.openResult(t, boxSk); if (await DB.get('resultados', env.id)) return false; await DB.put('resultados', env.id, { rid: env.id, ev: env.ev, token: C.cleanTok(t), ts: Date.now() }); await DB.logEv('resultado_recibido', { id: env.id, ev: env.ev }); return true; };
    const head = ['Matrícula', 'Nombre', 'Evaluación', ...(adm ? ['Forma', 'Aciertos'] : []), 'Incidentes', 'Autenticidad', 'Acuse', ''];
    root.replaceChildren(card(h('h3', null, titulo || 'Resultados'),
      pasteScan('Pega o escanea el resultado de un cadete (RS2.…)', async t => { try { if (!(await add(t))) toast('Ya estaba registrado (idempotente).'); await draw(); } catch (e) { toast(e.message); } }, 'Pega aquí el resultado (RS2.…)'),
      h('label', { class: 'btn ghost' }, 'Importar archivos .evres', h('input', { type: 'file', multiple: true, hidden: true, onchange: async e => { let n = 0; for (const f of e.target.files) { const all = (await readText(f)).split(/\s+/); for (const t of all.filter(x => x.startsWith('RS2.'))) { try { if (await add(t)) n++; } catch { } } if (adm) for (const t of all.filter(x => x.startsWith('BT1.'))) { try { await importarBitacora(t, boxSk); } catch { } } } toast(n + ' resultados nuevos'); await DB.logEv('importar_resultados', { n }); await draw(); } })),
      adm ? null : h('p', { class: 'mini' }, 'Como aplicador no ves la forma ni la calificación: la Administración califica. Exporta los resultados cifrados y entrégaselos.')),
      card(table(head, rows.map(x => x.r ? [x.r.cad.mat, x.r.cad.nom, P.etiquetaES(x.r.ty, x.r.pa),
        ...(adm ? [x.fo, x.sc ? `${x.sc.a}/${x.sc.n} (${Math.round(100 * x.sc.a / x.sc.n)}%)` : 'pendiente (sin clave)'] : []),
        h('div', null, h('span', { class: 'pill ' + ((x.r.inc || []).length ? 'bad' : 'ok') }, `${(x.r.inc || []).length}${x.r.motivo === 'incidentes' ? ' · CERRADO POR INCIDENTES' : ''}`), (x.r.inc || []).length ? h('button', { class: 'btn sm ghost', onclick: () => { DB.logEv('ver_evidencia', { mat: x.r.cad.mat, ev: x.r.ev }); root.prepend(evidenciaCard(x.r)); } }, 'Evidencia') : null),
        h('span', { class: 'pill ' + (x.ok ? 'ok' : x.ok === false ? 'bad' : 'warn') }, x.ok ? 'PIN verificado' : x.ok === false ? 'MAC inválido' : adm ? 'no verificable (código de otro dispositivo)' : 'lo verifica la Administración'),
        dup[x.r.ev + '|' + x.r.cad.mat.toUpperCase()].length > 1 ? h('span', { class: 'pill bad' }, 'DUPLICADO') : '',
        issuerSk ? h('button', { class: 'btn sm ghost', onclick: () => { DB.logEv('acuse', { mat: x.r.cad.mat, ev: x.r.ev }); const a = P.mkAck(issuerSk, x.r.ev, x.r.id); root.prepend(card(h('div', null, tokenBox(a, 'Acuse: entrégalo al cadete (pegar o QR) para que su equipo marque «entregado».', 'acuse.txt')))); } }, 'Acuse') : ''] : [x.rec.rid.slice(0, 8), x.fail || '—', ...head.slice(2).map(() => '')])),
        h('div', { class: 'row' }, adm ? btn('Exportar a Excel', async () => { if (!good.length) return toast('Sin resultados.'); await DB.logEv('exportar_excel', { n: good.length }); expo(good); }) : null, btn(adm ? 'Exportar resultados (cifrados)' : 'Exportar resultados (cifrados) para la Administración', async () => { await DB.logEv('exportar_resultados', { n: rows.length }); const extra = adm ? [] : [P.mkBitacora(await DB.dispositivo(), await DB.logAll())]; download('resultados.evres', [...rows.map(x => x.rec.token), ...extra].join('\n'), 'text/plain'); }, 'ghost'))));
  }
  function expo(good) {
    const head = ['Matrícula', 'Nombre', 'Año', 'Grupo', 'Evaluación', 'Forma', 'Código', 'Inicio', 'Fin', 'Duración (min)', 'Incidentes', 'Cierre', 'Bloque inicial', 'Huella de orden', 'Aciertos', 'Total', '%', 'Calificación (0-10)', 'PIN verificado', 'ID resultado'];
    const rows = good.map(x => { const r = x.r; return [r.cad.mat, r.cad.nom, r.cad.an, r.cad.gr, P.etiquetaES(r.ty, r.pa), x.fo || '', r.ev.slice(0, 8), new Date(r.t0).toLocaleString('es-MX'), new Date(r.t1).toLocaleString('es-MX'), Math.round((r.t1 - r.t0) / 60000), (r.inc || []).length, ({ incidentes: 'cerrado por incidentes', tiempo: 'tiempo agotado', cadete: 'entregado por el cadete' })[r.motivo] || '', r.blk === 'A' ? 'con audio' : r.blk === 'T' ? 'sin audio' : '', r.ord || '', x.sc ? x.sc.a : '', x.sc ? x.sc.n : '', x.sc ? Math.round(1000 * x.sc.a / x.sc.n) / 10 : '', x.sc ? Math.round(100 * 10 * x.sc.a / x.sc.n) / 100 : '', x.ok ? 'sí' : 'no', r.id]; });
    const det = good.map(x => [x.r.cad.mat, x.r.cad.nom, x.fo || '', ...x.r.an.split('')]);
    const inc = good.flatMap(x => (x.r.inc || []).map(i => [x.r.cad.mat, x.r.cad.nom, i.n, TIPOS[i.tipo] || i.tipo, new Date(i.t).toLocaleString('es-MX'), i.pos || '', i.img ? 'sí (en la app)' : 'no']));
    exportXlsx('resultados_evaluacion_oficial.xlsx', [{ name: 'Resultados', head, rows }, { name: 'Incidentes', head: ['Matrícula', 'Nombre', 'N.º', 'Tipo', 'Hora', 'Reactivo (posición)', 'Imagen'], rows: inc }, { name: 'Respuestas', head: ['Matrícula', 'Nombre', 'Forma', ...Array.from({ length: Math.max(0, ...good.map(x => x.r.an.length)) }, (_, i) => 'R' + (i + 1))], rows: det }]);
  }
  await draw(); return root;
}

// Evidencia de integridad de un resultado: lista de incidentes con hora, tipo e imagen del examen en ese momento.
export function evidenciaCard(r) {
  const ok = s => typeof s === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s);
  return card(h('h3', null, `Evidencia · ${r.cad.mat} · ${r.cad.nom}`), h('p', { class: 'mini' }, `${(r.inc || []).length} incidentes${r.motivo === 'incidentes' ? ' · el examen se cerró automáticamente al 3.º' : ''}. Las imágenes las generó la app con el estado del examen en ese momento (no son capturas del sistema operativo).`),
    h('div', { class: 'evid' }, (r.inc || []).map(i => h('figure', null, ok(i.img) ? h('img', { src: i.img, alt: 'Incidente ' + i.n }) : h('p', { class: 'mini' }, 'sin imagen'), h('figcaption', null, `${i.n}. ${TIPOS[i.tipo] || i.tipo} · ${new Date(i.t).toLocaleString('es-MX')}${i.pos ? ' · reactivo ' + i.pos : ''}`)))),
    btn('Cerrar', e => e.target.closest('section').remove(), 'sm ghost'));
}

// ---------- Bitácora (v0.4) ----------
// Cualquier perfil: exporta la bitácora completa de su dispositivo, SELLADA para la Administración (nadie más la lee).
export function bitacoraUI() {
  const st = h('p', { class: 'mini' });
  return card(h('h3', null, 'Bitácora de este dispositivo'), h('p', { class: 'mini' }, 'Todo lo que se hace en este dispositivo (accesos, vistas, códigos, exámenes, incidentes, exportaciones) queda registrado con nombre, perfil, dispositivo, fecha y hora, encadenado con hashes. Solo la Administración puede abrirla: entrégale el archivo cuando te lo pida.'),
    btn('Exportar bitácora para la Administración (.evlog)', async () => { await DB.logEv('exportar_bitacora', {}); const dev = await DB.dispositivo(), regs = await DB.logAll(); download(`bitacora_${dev}.evlog`, P.mkBitacora(dev, regs), 'text/plain'); st.textContent = `${regs.length} registros exportados.`; }), st);
}
export async function importarBitacora(tok, admBoxSk) {
  const { dev, regs } = P.openBitacora(tok, admBoxSk), v = await DB.verificarCadena(regs, true), prev = await DB.get('bitacoras', dev);
  let alterada = !v.ok; if (prev && prev.regs.some((r, i) => !regs[i] || regs[i].h !== r.h)) alterada = true; // lo ya recibido cambió o desapareció
  await DB.put('bitacoras', dev, { dev, regs: alterada && prev && prev.regs.length > regs.length ? prev.regs : regs, ok: !alterada, rotos: v.rotos, recibida: Date.now(), previa: prev ? prev.regs.length : 0 });
  await DB.logEv('importar_bitacora', { dev, n: regs.length, integra: !alterada }); return { dev, n: regs.length, ok: !alterada };
}
const ROL_ES = { admin: 'Administración', aplicador: 'Aplicador', directora: 'Directora', piloto: 'Piloto', cadete: 'Cadete', inicio: '(sin sesión)' };
// Administración: bitácora completa de todos (propia + importadas + la que viaja dentro de cada resultado).
export async function bitacoraAdminUI(boxSk) {
  const root = h('div'), fil = { rol: '' };
  async function filas() {
    const out = [], own = await DB.logAll(), dv = await DB.dispositivo(), vo = await DB.verificarCadena(own, true);
    for (const r of own) out.push({ ...r, fuente: 'este dispositivo', cad: vo.ok ? 'íntegra' : 'ALTERADA' });
    for (const [, b] of await DB.all('bitacoras')) if (b.dev !== dv) for (const r of b.regs) out.push({ ...r, fuente: 'bitácora importada', cad: b.ok ? 'íntegra' : 'ALTERADA' });
    for (const [, rec] of await DB.all('resultados')) { try { const { r } = P.openResult(rec.token, boxSk); const v = await DB.verificarCadena(r.bt || [], false); for (const x of r.bt || []) out.push({ ...x, fuente: 'dentro del resultado', cad: v.ok ? 'íntegra (parcial)' : 'ALTERADA' }); } catch { } }
    const seen = new Set(); return out.filter(r => { const k = r.dev + r.h; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.ts - a.ts);
  }
  async function draw() {
    const all = await filas(), rows = all.filter(r => !fil.rol || r.rol === fil.rol), devs = new Set(all.map(r => r.dev));
    const ta = h('textarea', { class: 'tok', rows: 2, placeholder: 'Pega una bitácora (BT1.…)' });
    const sel = h('select', { onchange: e => { fil.rol = e.target.value; draw(); } }, h('option', { value: '' }, 'Todos los perfiles'), Object.entries(ROL_ES).map(([k, v]) => h('option', { value: k, selected: fil.rol === k }, v)));
    root.replaceChildren(card(h('h3', null, `Bitácora de actividad · ${all.length} registros · ${devs.size} dispositivos`), h('p', { class: 'mini' }, 'Quién, perfil, dispositivo, fecha y hora y acción de todos los perfiles (Directora incluida). Cada dispositivo encadena sus registros con hashes: si alguien borra o edita un registro intermedio, la cadena sale «ALTERADA». Sin internet, la bitácora de cada dispositivo llega cuando se importa su archivo .evlog (el aplicador la manda junto con sus resultados; la del cadete viaja dentro de su resultado).'),
      h('div', { class: 'row' }, ta, btn('Importar bitácora', async () => { try { const r = await importarBitacora(ta.value, boxSk); toast(`${r.n} registros · ${r.ok ? 'íntegra' : 'ALTERADA'}`); draw(); } catch (e) { toast(e.message); } }, 'sm'),
        h('label', { class: 'btn ghost sm' }, 'Importar archivos .evlog', h('input', { type: 'file', multiple: true, hidden: true, onchange: async e => { let n = 0; for (const f of e.target.files) for (const t of (await readText(f)).split(/\s+/).filter(x => x.startsWith('BT1.'))) { try { await importarBitacora(t, boxSk); n++; } catch { } } toast(n + ' bitácoras importadas'); draw(); } }))),
      h('div', { class: 'row' }, field('Perfil', sel), btn('Exportar a Excel', async () => { await DB.logEv('exportar_bitacora_excel', { n: rows.length }); exportXlsx('bitacora_evaluacion_oficial.xlsx', [{ name: 'Bitácora', head: ['Fecha y hora', 'Quién', 'Perfil', 'Dispositivo', 'Equipo', 'Acción', 'Detalle', 'Fuente', 'Cadena', 'Hash', 'Hash anterior'], rows: rows.map(r => [new Date(r.ts).toLocaleString('es-MX'), r.quien || '—', ROL_ES[r.rol] || r.rol || '—', r.dev || '—', r.eq || '—', r.ev, JSON.stringify(r.det || {}), r.fuente, r.cad, r.h, r.prev]) }]); }, 'sm'),
        btn('Exportar JSON (verificable)', async () => { await DB.logEv('exportar_bitacora_json', { n: all.length }); download('bitacora_evaluacion_oficial.json', JSON.stringify(all, null, 1), 'application/json'); }, 'sm ghost'))),
      card(table(['Fecha y hora', 'Quién', 'Perfil', 'Dispositivo', 'Acción', 'Detalle', 'Cadena'], rows.slice(0, 400).map(r => [new Date(r.ts).toLocaleString('es-MX'), r.quien || '—', ROL_ES[r.rol] || r.rol || '—', h('span', { title: r.eq || '' }, r.dev || '—'), r.ev, h('small', null, JSON.stringify(r.det || {}).slice(0, 110)), h('span', { class: 'pill ' + (/ALTERADA/.test(r.cad) ? 'bad' : 'ok') }, r.cad)])), rows.length > 400 ? h('p', { class: 'mini' }, 'Se muestran 400; el Excel trae todos.') : null));
  }
  await draw(); return root;
}
// Administración → paquete de consulta para la Directora: SIN forma, PIN, códigos ni número de reactivos.
export async function datosConsulta(ks) {
  const t = P.now(), em = (await DB.all('emitidos')).map(x => x[1]).sort((a, b) => b.ts - a.ts), creds = (await DB.get('kv', 'creds')) || [];
  const resultados = []; for (const [, rec] of await DB.all('resultados')) { try { const { r } = P.openResult(rec.token, ks.box.sk); const x = P.formaDe(r, ks.box.sk), f = x && ks.forms[x.s]; let pct = null, cal = null; if (f && f.k) { let a = 0; r.an.split('').forEach((c, i) => { if (c !== '-' && 'ABCD'.indexOf(c) === f.k[i]) a++; }); pct = Math.round(1000 * a / f.k.length) / 10; cal = Math.round(100 * 10 * a / f.k.length) / 100; }
    resultados.push({ mat: r.cad.mat, nom: r.cad.nom, an: r.cad.an, gr: r.cad.gr, ty: r.ty, pa: r.pa, pct, cal, motivo: r.motivo, t0: r.t0, t1: r.t1, inc: (r.inc || []).map(i => ({ n: i.n, tipo: i.tipo, t: i.t, pos: i.pos, img: i.img })) }); } catch { } }
  const fs_ = Object.values(ks.forms).filter(f => f.estado === 'aprobada');
  return { formas: { ALC: fs_.filter(f => f.clase === 'ALC').length, ALCPT: fs_.filter(f => f.clase === 'ALCPT').length },
    emitidos: em.map(e => ({ ty: e.ty, pa: e.pa, nb: e.nb, ex: e.ex, du: e.du, ap: e.ap, estado: t > e.ex ? 'vencido' : t < e.nb ? 'programado' : 'vigente' })),
    resultados, personal: creds.map(c => ({ nm: c.core.nm, rol: c.core.rol || 'aplicador', nb: c.core.nb, ex: c.core.ex, estado: c.rev ? 'revocado' : t > c.core.ex ? 'vencido' : 'vigente' })) };
}
