// Orden aleatorio por intento (compartido por las versiones SIN y CON internet).
// La semilla se deriva de datos únicos del intento (id aleatorio + matrícula + evaluación), así que cada cadete ve
// un orden distinto de reactivos y de opciones. Las respuestas se guardan SIEMPRE en el orden original
// (índice de reactivo y de opción del banco), por eso la calificación con la clave no cambia.
const LET_REF = /\b(all|none|both|neither) of the (above|options|answers)\b|\b[A-D]\s*(and|or|&|y|o)\s*[A-D]\b|\btodas las anteriores\b|\bninguna de las anteriores\b/i;
async function seedWords(seed) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('EO-ORDEN|' + seed)));
  const v = new DataView(d.buffer); return [0, 4, 8, 12].map(o => v.getUint32(o));
}
function sfc32(a, b, c, d) { // generador pseudoaleatorio pequeño y rápido (determinista con la semilla)
  return () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; };
}
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// items: [{au?, pas?, o:[...]}] en el orden del banco. Devuelve { A:[índices con audio], T:[índices sin audio], op:{índice:[perm]} }.
// Los reactivos que comparten lectura (pas) se mantienen juntos (el grupo se baraja como unidad y también por dentro).
export async function plan(items, seed) {
  const rnd = sfc32(...await seedWords(seed)), out = { A: [], T: [], op: {} };
  for (const blk of ['A', 'T']) {
    const idx = items.map((x, i) => i).filter(i => (blk === 'A') === !!items[i].au), groups = new Map();
    for (const i of idx) { const k = items[i].pas ? 'p|' + items[i].pas : 'i|' + i; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    for (const g of shuffle([...groups.values()], rnd)) out[blk].push(...shuffle(g, rnd));
  }
  items.forEach((x, i) => { const n = (x.o || []).length; const refs = (x.o || []).some(t => LET_REF.test(String(t))); out.op[i] = refs ? [...Array(n).keys()] : shuffle([...Array(n).keys()], rnd); });
  return out;
}
// Huella corta del orden (para la evidencia/auditoría): permite comprobar después qué orden vio el cadete.
export async function huellaOrden(p) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(p)))); return [...d.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}
