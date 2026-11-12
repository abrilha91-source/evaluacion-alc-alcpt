// IndexedDB local: todo queda en el dispositivo; no hay envío por red.
const NAME = 'eo2'; // v0.4: base nueva (los datos de evaluación se guardan como bloques opacos en «d»)
const STORES = ['kv', 'd', 'attempts', 'emitidos', 'resultados', 'log', 'borradores', 'bitacoras', 'adjuntos'];
let _db;
const open = () => _db || (_db = new Promise((ok, no) => {
  const r = indexedDB.open(NAME, 2);
  r.onupgradeneeded = () => { const d = r.result; for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
}));
const tx = async (s, mode, fn) => { const d = await open(); return new Promise((ok, no) => { const t = d.transaction(s, mode), st = t.objectStore(s); const q = fn(st); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); };
export const get = (s, k) => tx(s, 'readonly', st => st.get(k));
export const put = (s, k, v) => tx(s, 'readwrite', st => st.put(v, k));
export const del = (s, k) => tx(s, 'readwrite', st => st.delete(k));
export const all = async s => { const d = await open(); return new Promise((ok, no) => { const t = d.transaction(s, 'readonly'), st = t.objectStore(s), keys = st.getAllKeys(), vals = st.getAll(); t.oncomplete = () => ok(keys.result.map((k, i) => [k, vals.result[i]])); t.onerror = () => no(t.error); }); };
export const clearAll = async () => { const d = await open(); for (const s of STORES) await tx(s, 'readwrite', st => st.clear()); ULT = null; };
// Bitácora encadenada (cada registro incluye el hash del anterior): detecta ediciones o borrados intermedios.
// v0.4: cada registro dice QUIÉN (nombre), con qué ROL, en qué DISPOSITIVO (id aleatorio + resumen del equipo) y cuándo.
let ACTOR = { quien: '—', rol: 'inicio' };
export const setActor = (quien, rol) => { ACTOR = { quien: String(quien || '—').slice(0, 80), rol }; };
export const actor = () => ACTOR;
export const equipo = () => { try { const n = navigator, ua = n.userAgent || ''; const so = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'otro'; const nav = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'otro'; return `${so} · ${nav} · ${screen.width}×${screen.height}${matchMedia('(display-mode: standalone)').matches ? ' · instalada' : ''}`; } catch { return '—'; } };
export async function dispositivo() { let d = await get('kv', 'dev'); if (!d) { const { hex, rnd } = await import('./crypto.js'); d = 'D' + hex(rnd(6)).toUpperCase(); await put('kv', 'dev', d); } return d; }
export const hashReg = async r => { const { sha256, hex, enc } = await import('./crypto.js'); const { ts, ev, det, quien, rol, dev, eq, prev } = r; return hex(await sha256(enc.encode(JSON.stringify({ ts, ev, det, quien, rol, dev, eq, prev })))).slice(0, 16); };
// Los registros se escriben EN FILA (uno tras otro) para que la cadena nunca se bifurque aunque varios eventos ocurran a la vez.
let COLA = Promise.resolve(), ULT = null, TSU = 0;
async function _log(ev, det) {
  if (ULT === null) { const rows = await all('log'); const l = rows.length ? rows[rows.length - 1][1] : null; ULT = l ? l.h : '0'.repeat(16); TSU = l ? l.ts : 0; }
  const ts = Math.max(Date.now(), TSU + 1); // orden estricto
  const rec = { ts, ev, det: det || {}, quien: ACTOR.quien, rol: ACTOR.rol, dev: await dispositivo(), eq: equipo(), prev: ULT }; rec.h = await hashReg(rec);
  await put('log', String(rec.ts).padStart(15, '0') + rec.h, rec); ULT = rec.h; TSU = ts; return rec;
}
export function logEv(ev, det) { const p = COLA.then(() => _log(ev, det)); COLA = p.catch(() => { ULT = null; }); return p; }
export const logAll = async () => (await all('log')).map(x => x[1]);
// Verifica una cadena: {ok, rotos:[índices]} (completa = empieza en génesis y cada prev coincide)
export async function verificarCadena(regs, completa = true) {
  const rotos = []; for (let i = 0; i < regs.length; i++) { const r = regs[i]; if ((await hashReg(r)) !== r.h) rotos.push(i); else if (completa && r.prev !== (i ? regs[i - 1].h : '0'.repeat(16))) rotos.push(i); }
  return { ok: !rotos.length, rotos };
}
// v0.4: limpia lo que la v0.3 dejaba en el dispositivo y que nombraba formas (paquetes por forma, índice con títulos y tamaños,
// caché «eo-packs-v1»). No toca intentos ni resultados de la v0.3.
export async function purgarV03() {
  try { for (const k of await caches.keys()) if (k === 'eo-packs-v1') await caches.delete(k); } catch { }
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'eo1' }]; if (!dbs.some(d => d.name === 'eo1')) return;
    await new Promise(ok => { const r = indexedDB.open('eo1'); r.onsuccess = () => { const d = r.result; try { const names = [...d.objectStoreNames]; const st = names.filter(n => n === 'packs' || n === 'kv'); if (!st.length) { d.close(); return ok(); } const t = d.transaction(st, 'readwrite'); if (names.includes('packs')) t.objectStore('packs').clear(); if (names.includes('kv')) t.objectStore('kv').delete('index'); t.oncomplete = () => { d.close(); ok(); }; t.onerror = t.onabort = () => { d.close(); ok(); }; } catch { d.close(); ok(); } }; r.onerror = () => ok(); r.onupgradeneeded = () => { r.transaction.abort(); }; });
  } catch { }
}
