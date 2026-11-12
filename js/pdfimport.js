// Importación de bancos oficiales TEXTUALES (PDF con capa de texto) → borrador con validaciones. Formato común a las dos versiones.
import { h, btn, toast, readFile, readText, table } from './util.js';
import { sha256, hex, enc } from './crypto.js';
export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const huella = async (q, o) => hex(await sha256(enc.encode(norm(q) + '|' + [...o].map(norm).sort().join('|')))).slice(0, 16);

export async function pdfText(bytes) {
  const pdfjs = await import('../vendor/pdf.min.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    const u = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
    const tt = window.trustedTypes ? window.trustedTypes.createPolicy('eo-worker', { createScriptURL: x => { if (x !== u) throw new Error('URL no permitida'); return x; } }) : null;
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(tt ? tt.createScriptURL(u) : u, { type: 'module' });
  }
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true, disableFontFace: true }).promise;
  let out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent(), rows = [];
    for (const t of tc.items) { if (!t.str) continue; const y = Math.round(t.transform[5] / 3); let r = rows.find(r => Math.abs(r.y - y) <= 1); if (!r) rows.push(r = { y, parts: [] }); r.parts.push([t.transform[4], t.str]); }
    rows.sort((a, b) => b.y - a.y); for (const r of rows) out.push(r.parts.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').replace(/\s+/g, ' ').trim());
  }
  const txt = out.join('\n'); if (txt.replace(/\s/g, '').length < 40) throw new Error('El PDF no tiene texto seleccionable (parece un escaneo). Esta versión solo importa PDF textuales.');
  return txt;
}
export function parseKey(text) { const k = {}; for (const m of String(text || '').matchAll(/(\d{1,3})\s*[-.):=]?\s*([A-Da-d])\b/g)) if (!(m[1] in k)) k[+m[1]] = 'ABCD'.indexOf(m[2].toUpperCase()); return k; }
export function parseQuestions(text, key = {}) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean), items = []; let cur = null, sec = 'R', pas = '', pasOpen = false, pasFor = '';
  const closeCur = () => { cur = null; };
  for (let ln of lines) {
    if (/^(part\s+[a-d]\b.*)?listening\b/i.test(ln) && ln.length < 60 && !/^\d/.test(ln)) { sec = 'L'; closeCur(); continue; }
    if (/^(part\s+[a-d]\b.*)?(reading|grammar|vocabulary)\b/i.test(ln) && ln.length < 60 && !/^\d/.test(ln)) { sec = 'R'; closeCur(); continue; }
    const mo = ln.match(/^\(?([A-Da-d])[.)]\s*(.*)$/);
    if (cur && /^\(?A[.)]\s.*\s[B][.)]\s/.test(ln)) { const parts = ln.split(/\s(?=[B-D][.)]\s)/); for (const p of parts) { const m = p.match(/^\(?([A-D])[.)]\s*(.*)$/); if (m) cur.o[m[1].charCodeAt(0) - 65] = m[2].trim(); } continue; }
    const mq = ln.match(/^(\d{1,3})\s*[.)\-]\s+(\S.*)$/);
    if (mq && !(cur && cur.o.filter(x => x != null).length < 4 && mo)) {
      cur = { n: +mq[1], sec, q: mq[2], o: [], pas: pasOpen ? pas : '', k: key[+mq[1]] ?? null }; items.push(cur); pasOpen = pas.length > 0 && pasOpen; continue;
    }
    if (mo && cur) { cur.o[mo[1].toUpperCase().charCodeAt(0) - 65] = mo[2].trim(); cur.last = mo[1].toUpperCase().charCodeAt(0) - 65; continue; }
    if (cur && cur.last != null && cur.o[cur.last] != null && cur.o.filter(x => x != null).length < 4) { cur.o[cur.last] += ' ' + ln; continue; }
    if (cur && cur.o.filter(x => x != null).length === 0) { cur.q += ' ' + ln; continue; }
    if (cur && cur.o.filter(x => x != null).length >= 4) { cur = null; pas = ''; pasOpen = true; }
    if (!cur) { pas = pas ? pas + ' ' + ln : ln; pasOpen = true; }
  }
  return items.map(it => { delete it.last; it.o = [0, 1, 2, 3].map(i => it.o[i] ?? ''); return it; });
}
export async function validate(items, { audio = {}, known = new Set() } = {}) {
  const seenN = {}, seenH = {};
  for (const it of items) { seenN[it.n] = (seenN[it.n] || 0) + 1; }
  for (const it of items) {
    const e = [], filled = it.o.filter(x => String(x).trim()).length;
    if (filled !== 4) e.push('no tiene 4 opciones');
    else if (new Set(it.o.map(norm)).size < 4) e.push('opciones repetidas');
    if (!Number.isInteger(it.k) || it.k < 0 || it.k > 3) e.push('sin clave'); else if (!String(it.o[it.k] || '').trim()) e.push('la clave apunta a una opción vacía');
    if (!String(it.q || '').trim() && !(it.sec === 'L')) e.push('enunciado vacío');
    if (seenN[it.n] > 1) e.push('número repetido');
    if (it.sec === 'L' && !(it.au && audio[it.au])) e.push('listening sin audio');
    const hh = await huella(it.q, it.o);
    if (seenH[hh]) e.push('duplicado dentro de esta importación (#' + seenH[hh] + ')'); else seenH[hh] = it.n;
    if (known.has(hh)) e.push('duplicado de un reactivo ya cargado');
    it.err = e; it.hh = hh;
  }
  return items;
}
export function matchAudio(items, files) { // files: {nombre:Uint8Array}; se asigna por el último número del nombre
  for (const it of items) { it.au = null; }
  for (const nm of Object.keys(files)) { const m = nm.replace(/\.[^.]+$/, '').match(/(\d+)(?!.*\d)/); if (!m) continue; const it = items.find(x => x.n === +m[1]); if (it) it.au = nm; }
}
// Editor de borrador. ctx: {known:Set, save(d), approve(d, soloValidos), discard(d)}
export function draftEditor(d, ctx) {
  const root = h('div', { class: 'draft' });
  async function redo() { await validate(d.items, { audio: d.audio, known: ctx.known }); draw(); }
  function draw() {
    const bad = d.items.filter(x => x.err.length), ok = d.items.length - bad.length;
    root.replaceChildren(
      h('p', null, `${d.items.length} reactivos detectados · `, h('b', { class: bad.length ? 'badt' : 'okt' }, `${ok} válidos, ${bad.length} con errores`), ' · estado: ', h('span', { class: 'pill warn' }, 'BORRADOR (no se puede usar en evaluaciones)')),
      h('label', null, 'Audios de los reactivos de listening (MP3/M4A; el número del reactivo va al final del nombre, p. ej. item_07.mp3)', h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.m4a', onchange: async e => { for (const f of e.target.files) d.audio[f.name] = await readFile(f); matchAudio(d.items, d.audio); await redo(); toast('Audios asignados'); } })),
      h('div', { class: 'tw' }, h('table', null, h('tr', null, ['#', 'Sec.', 'Reactivo', 'A', 'B', 'C', 'D', 'Clave', 'Audio', 'Problemas'].map(x => h('th', null, x))),
        d.items.map(it => h('tr', { class: it.err.length ? 'rowbad' : '' },
          h('td', null, String(it.n)),
          h('td', null, h('select', { onchange: e => { it.sec = e.target.value; redo(); } }, ['R', 'L'].map(v => h('option', { value: v, selected: it.sec === v }, v)))),
          h('td', null, it.pas ? h('small', null, 'Pasaje: ' + it.pas.slice(0, 80) + '…') : null, h('textarea', { rows: 2, onchange: e => { it.q = e.target.value; redo(); } }, it.q)),
          [0, 1, 2, 3].map(k => h('td', null, h('input', { value: it.o[k], onchange: e => { it.o[k] = e.target.value; redo(); } }))),
          h('td', null, h('select', { onchange: e => { it.k = e.target.value === '' ? null : +e.target.value; redo(); } }, h('option', { value: '' }, '—'), 'ABCD'.split('').map((l, k) => h('option', { value: k, selected: it.k === k }, l)))),
          h('td', null, it.sec === 'L' ? (it.au ? h('small', null, it.au) : h('small', { class: 'badt' }, 'falta')) : '—'),
          h('td', { class: 'errs' }, it.err.join('; ')))))),
      h('div', { class: 'row' }, btn('Guardar borrador', async () => { await ctx.save(d); toast('Borrador guardado'); }, 'ghost'),
        btn(bad.length ? `Aprobar solo los ${ok} válidos (excluye ${bad.length})` : 'Aprobar y publicar para evaluaciones', async () => { if (!ok) return toast('No hay reactivos válidos.'); if (confirm(`Se publicarán ${ok} reactivos${bad.length ? ` y se EXCLUIRÁN ${bad.length} con errores` : ''}. La forma quedará aprobada por ti. ¿Continuar?`)) await ctx.approve(d); }),
        btn('Descartar borrador', async () => { if (confirm('¿Descartar este borrador?')) await ctx.discard(d); }, 'ghost')));
  }
  redo(); return root;
}
export async function newDraftUI(ctx) { // formulario de carga: PDF + clave
  const st = { titulo: '', tipo: 'ALCPT final', du: 100, pdf: null, keyPdf: null, keyText: '' };
  const out = h('div');
  const box = h('div', { class: 'card' }, h('h3', null, 'Importar banco oficial (PDF textual)'),
    h('p', { class: 'mini' }, 'El PDF debe tener texto seleccionable (no escaneo). Formato esperado: «1. pregunta» y opciones «A) … B) … C) … D) …»; secciones con encabezados «Listening» y «Reading». La clave puede ir en otro PDF o pegarse («1-A 2-C 3-B …»).'),
    h('label', null, 'Nombre de la forma', h('input', { id: 'dn', placeholder: 'Nombre interno (solo lo ve la Administración)', onchange: e => st.titulo = e.target.value })),
    h('label', null, 'Tipo', h('select', { onchange: e => st.tipo = e.target.value }, ['ALCPT final', 'ALC parcial'].map(x => h('option', null, x)))),
    h('label', null, 'Duración (minutos)', h('input', { type: 'number', value: 100, min: 10, max: 240, onchange: e => st.du = +e.target.value })),
    h('label', null, 'PDF de la forma', h('input', { type: 'file', accept: 'application/pdf', onchange: async e => st.pdf = e.target.files[0] && await readFile(e.target.files[0]) })),
    h('label', null, 'PDF de la clave (opcional)', h('input', { type: 'file', accept: 'application/pdf', onchange: async e => st.keyPdf = e.target.files[0] && await readFile(e.target.files[0]) })),
    h('label', null, 'o pega la clave', h('textarea', { placeholder: '1-A 2-C 3-B …', onchange: e => st.keyText = e.target.value })),
    btn('Leer y crear borrador', async () => {
      try {
        if (!st.pdf) return toast('Elige el PDF de la forma.'); if (!st.titulo.trim()) return toast('Escribe el nombre de la forma.');
        const txt = await pdfText(st.pdf); let kt = st.keyText; if (st.keyPdf) kt += '\n' + await pdfText(st.keyPdf);
        const items = parseQuestions(txt, parseKey(kt)); if (!items.length) return toast('No se detectaron reactivos con el formato esperado.');
        const d = { id: 'IMP-' + Date.now().toString(36).toUpperCase(), titulo: st.titulo.trim(), tipo: st.tipo, du: st.du, items, audio: {}, creado: Date.now() };
        await ctx.save(d); out.replaceChildren(draftEditor(d, ctx));
      } catch (e) { toast(e.message); }
    }));
  return h('div', null, box, out);
}
