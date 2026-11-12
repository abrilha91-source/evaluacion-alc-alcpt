// v0.4 · «Adjuntar formas oficiales» (SOLO Administración).
// Los archivos (PDF, Word, Excel, PNG, JPG, MP3, WAV, MP4) se guardan ÚNICAMENTE en el dispositivo de la Administración,
// cifrados en reposo con AES-256-GCM. La clave de archivos (fk) vive dentro del llavero cifrado con la frase de la
// Administración (PBKDF2-SHA256 600 000): sin la frase no se descifran, y cambiar la frase no obliga a recifrarlos.
// Nombre, tipo, etiquetas y contenido van cifrados; en IndexedDB solo queda un id aleatorio, el tamaño y la fecha.
// Nunca se suben, no se publican, no entran al service worker ni a los paquetes de Directora, Piloto, Aplicador o Cadete.
import * as C from './crypto.js'; import * as P from './protocol.js'; import * as DB from './db.js';
import { h, btn, card, toast, field, table, readFile, download } from './util.js';
const MB = 1024 * 1024;
export const TIPOS_ARCH = { // extensión → [nombre, MIME, límite por archivo, firma]
  pdf: ['PDF', 'application/pdf', 25 * MB, u => u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46],
  docx: ['Word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 25 * MB, u => u[0] === 0x50 && u[1] === 0x4b],
  xlsx: ['Excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 25 * MB, u => u[0] === 0x50 && u[1] === 0x4b],
  png: ['Imagen PNG', 'image/png', 10 * MB, u => u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47],
  jpg: ['Imagen JPG', 'image/jpeg', 10 * MB, u => u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff],
  mp3: ['Audio MP3', 'audio/mpeg', 25 * MB, u => (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) || (u[0] === 0xff && (u[1] & 0xe0) === 0xe0)],
  wav: ['Audio WAV', 'audio/wav', 40 * MB, u => u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x41],
  mp4: ['Video MP4', 'video/mp4', 60 * MB, u => u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70],
};
export const TOTAL_MAX = 400 * MB; // tope de la app para no agotar el almacenamiento del navegador en teléfonos
const extDe = n => { const e = (String(n).split('.').pop() || '').toLowerCase(); return e === 'jpeg' ? 'jpg' : e; };
export const fmtTam = b => b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const AAD = (id, k) => C.enc.encode('EVA1|' + id + '|' + k);
export function claveArchivos(ks) { if (!ks.fk) ks.fk = C.b64(C.rnd(32)); return C.unb64(ks.fk); } // se guarda con persist()
export function validar(name, u8, usado = 0) {
  const e = extDe(name), t = TIPOS_ARCH[e]; if (!t) throw new Error(`Tipo no permitido (${e || 'sin extensión'}). Solo PDF, Word (.docx), Excel (.xlsx), PNG, JPG, MP3, WAV o MP4.`);
  if (!u8.length) throw new Error('El archivo está vacío.'); if (u8.length > t[2]) throw new Error(`${t[0]}: máximo ${fmtTam(t[2])} por archivo (este pesa ${fmtTam(u8.length)}).`);
  if (!t[3](u8)) throw new Error(`El contenido no corresponde a un archivo ${t[0]} (¿extensión cambiada?).`);
  if (usado + u8.length > TOTAL_MAX) throw new Error(`Se superaría el tope de ${fmtTam(TOTAL_MAX)} para adjuntos en este dispositivo.`); return e;
}
export async function guardar(fk, name, u8, tags = {}) {
  const ext = validar(name, u8, await usado()), id = 'A' + C.hex(C.rnd(10)), ts = Date.now();
  const meta = { nombre: String(name).slice(0, 160), ext, mime: TIPOS_ARCH[ext][1], tam: u8.length, ts, ty: tags.ty || '', pa: tags.pa || null, s: tags.s || '', nota: (tags.nota || '').slice(0, 200) };
  await DB.put('adjuntos', id, { id, tam: u8.length, ts, m: await C.aesEnc(fk, C.enc.encode(JSON.stringify(meta)), AAD(id, 'm')), c: await C.aesEnc(fk, u8, AAD(id, 'c')) });
  await DB.logEv('adjuntar_archivo', { id, tipo: ext, tam: u8.length, ty: meta.ty || null, s: meta.s || null }); return { id, ...meta };
}
export const usado = async () => (await DB.all('adjuntos')).reduce((a, [, r]) => a + r.tam, 0);
export async function listar(fk) { const out = []; for (const [, r] of await DB.all('adjuntos')) { try { out.push({ id: r.id, ...JSON.parse(C.dec.decode(await C.aesDec(fk, r.m, AAD(r.id, 'm')))) }); } catch { out.push({ id: r.id, nombre: '(no se pudo descifrar)', ext: '?', tam: r.tam, ts: r.ts, err: true }); } } return out.sort((a, b) => b.ts - a.ts); }
export async function abrir(fk, id) { const r = await DB.get('adjuntos', id); return C.aesDec(fk, r.c, AAD(id, 'c')); }
export async function etiquetar(fk, id, tags) { const r = await DB.get('adjuntos', id), m = JSON.parse(C.dec.decode(await C.aesDec(fk, r.m, AAD(id, 'm')))); Object.assign(m, tags); r.m = await C.aesEnc(fk, C.enc.encode(JSON.stringify(m)), AAD(id, 'm')); await DB.put('adjuntos', id, r); await DB.logEv('etiquetar_archivo', { id, ty: m.ty || null, pa: m.pa, s: m.s || null }); }
export async function borrar(id) { await DB.del('adjuntos', id); await DB.logEv('eliminar_archivo', { id }); }

const tagLabel = (m, forms) => [m.ty ? P.etiquetaES(m.ty, m.pa) : '', m.s ? (forms[m.s] ? forms[m.s].ti : 'casilla ' + m.s) : ''].filter(Boolean).join(' · ') || '—';
// Interfaz (pestaña «Adjuntos» de la Administración)
export async function adjuntosUI(ks, persist) {
  const nueva = !ks.fk, fk = claveArchivos(ks); if (nueva) await persist(); // la clave de archivos queda dentro del llavero cifrado
  const root = h('div'), prev = h('div'); let urlPrev = null;
  const cerrarPrev = () => { if (urlPrev) URL.revokeObjectURL(urlPrev); urlPrev = null; prev.replaceChildren(); };
  const slots = Object.entries(ks.forms).sort((a, b) => a[1].ti.localeCompare(b[1].ti));
  const tySel = (v = '') => h('select', null, h('option', { value: '' }, 'Sin evaluación'), Object.keys(P.TIPOS_EVAL).map(k => h('option', { value: k, selected: k === v }, P.etiquetaES(k, k === 'ALC_P' ? 1 : null).replace(/1\.ª evaluación parcial/, 'evaluación parcial'))));
  const paSel = (v = 1) => h('select', null, [1, 2, 3].map(n => h('option', { value: n, selected: +v === n }, n + '.ª parcial')));
  const sSel = (v = '') => h('select', null, h('option', { value: '' }, 'Sin forma asignada'), slots.map(([s, f]) => h('option', { value: s, selected: s === v }, f.ti)));
  async function draw() {
    cerrarPrev(); const L = await listar(fk), tot = L.reduce((a, x) => a + x.tam, 0); let est = null; try { est = await navigator.storage.estimate(); } catch { }
    const ty = tySel(), pa = paSel(), sl = sSel(), nota = h('input', { placeholder: 'Nota interna (opcional)' }), st = h('p', { class: 'mini' });
    const inp = h('input', { type: 'file', multiple: true, hidden: true, accept: '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp3,.wav,.mp4', onchange: async e => {
      let ok = 0; for (const f of e.target.files) { try { st.textContent = `Cifrando ${f.name}…`; await guardar(fk, f.name, await readFile(f), { ty: ty.value, pa: ty.value === 'ALC_P' ? +pa.value : null, s: sl.value, nota: nota.value }); ok++; } catch (x) { toast(f.name + ': ' + x.message); await DB.logEv('adjuntar_rechazado', { tipo: extDe(f.name), tam: f.size, motivo: String(x.message).slice(0, 60) }); } }
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { }
      if (ok) toast(`${ok} archivo(s) adjuntado(s) y cifrado(s) en este dispositivo.`); draw(); } });
    root.replaceChildren(
      card(h('h3', null, 'Adjuntar formas oficiales'), h('p', { class: 'mini' }, 'Solo Administración. Los archivos se quedan cifrados en ESTE dispositivo (clave protegida por tu frase del llavero); no se suben a internet, no se publican y nunca los ven Cadete, Piloto, Aplicador ni Directora. Todo adjuntar, ver, descargar, etiquetar y eliminar queda en la bitácora. Para que una forma se pueda aplicar, impórtala en «Importar banco»: aquí se guarda el original oficial como respaldo y referencia.'),
        h('p', { class: 'mini' }, `Permitidos: PDF, Word .docx y Excel .xlsx (máx. 25 MB c/u) · PNG/JPG (10 MB) · MP3 (25 MB) · WAV (40 MB) · MP4 (60 MB). Tope total de adjuntos: ${fmtTam(TOTAL_MAX)}.`),
        h('div', { class: 'g2' }, field('Evaluación (opcional)', ty), field('Parcial (solo ALC)', pa)), field('Forma (opcional, interna)', sl), field('Nota', nota),
        h('label', { class: 'btn big' }, '📎 Adjuntar formas oficiales', inp), st),
      card(h('h3', null, `Archivos adjuntos · ${L.length} · ${fmtTam(tot)}`), h('p', { class: 'mini' }, est && est.quota ? `Almacenamiento del navegador: ${fmtTam(est.usage || 0)} usados de ${fmtTam(est.quota)} disponibles para la app. En iPhone/iPad Safari puede borrar los datos de sitios no usados en varias semanas si la app no está instalada en la pantalla de inicio: instálala y conserva el respaldo del llavero y los originales fuera del teléfono.` : 'El navegador no informa su cuota de almacenamiento.'),
        L.length ? table(['Archivo', 'Tipo', 'Tamaño', 'Fecha', 'Evaluación / forma', ''], L.map(x => [h('b', null, x.nombre), TIPOS_ARCH[x.ext] ? TIPOS_ARCH[x.ext][0] : x.ext, fmtTam(x.tam), new Date(x.ts).toLocaleString('es-MX'), tagLabel(x, ks.forms),
          x.err ? btn('Eliminar', () => del(x), 'sm ghost') : h('div', { class: 'row' }, btn('Ver', () => ver(x), 'sm'), btn('Etiquetar', () => tag(x), 'sm ghost'), btn('Descargar', () => bajar(x), 'sm ghost'), btn('Eliminar', () => del(x), 'sm ghost'))])) : h('p', { class: 'mini' }, 'Sin archivos adjuntos.')), prev);
  }
  async function ver(x) {
    cerrarPrev(); const u8 = await abrir(fk, x.id); await DB.logEv('ver_archivo', { id: x.id, tipo: x.ext }); urlPrev = URL.createObjectURL(new Blob([u8], { type: x.mime }));
    const v = /^(png|jpg)$/.test(x.ext) ? h('img', { src: urlPrev, alt: x.nombre, class: 'prev' }) : /^(mp3|wav)$/.test(x.ext) ? h('audio', { src: urlPrev, controls: true }) : x.ext === 'mp4' ? h('video', { src: urlPrev, controls: true, playsinline: true, class: 'prev' }) : x.ext === 'pdf' ? h('iframe', { src: urlPrev, title: x.nombre, class: 'prevpdf' }) : h('p', { class: 'mini' }, 'Word y Excel no tienen vista previa sin internet. Usa «Descargar» (queda una copia SIN cifrar en el dispositivo: bórrala después).');
    prev.replaceChildren(card(h('h3', null, 'Vista previa: ' + x.nombre), v, btn('Cerrar vista previa', cerrarPrev, 'sm ghost'))); prev.scrollIntoView && prev.scrollIntoView();
  }
  async function bajar(x) { if (!confirm('Se guardará una copia SIN cifrar en las descargas de este dispositivo. ¿Continuar?')) return; const u8 = await abrir(fk, x.id); await DB.logEv('descargar_archivo', { id: x.id, tipo: x.ext }); download(x.nombre, u8, x.mime); }
  async function del(x) { if (!confirm(`¿Eliminar «${x.nombre}» de este dispositivo? No se puede deshacer (conserva el original en otro lugar).`)) return; await borrar(x.id); toast('Archivo eliminado.'); draw(); }
  function tag(x) { const ty = tySel(x.ty), pa = paSel(x.pa || 1), sl = sSel(x.s); cerrarPrev(); prev.replaceChildren(card(h('h3', null, 'Etiquetar: ' + x.nombre), h('div', { class: 'g2' }, field('Evaluación del archivo', ty), field('Parcial del archivo (solo ALC)', pa)), field('Forma del archivo (interna)', sl), btn('Guardar etiquetas', async () => { await etiquetar(fk, x.id, { ty: ty.value, pa: ty.value === 'ALC_P' ? +pa.value : null, s: sl.value }); toast('Etiquetas guardadas.'); draw(); }, 'sm'))); }
  await draw(); return root;
}
