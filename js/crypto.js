// Criptografía de Evaluación Oficial (compartida entre la app y las herramientas de construcción).
// AES-256-GCM + PBKDF2-SHA256 (WebCrypto), Ed25519 y X25519/XSalsa20-Poly1305 (TweetNaCl).
export const enc = new TextEncoder(), dec = new TextDecoder();
export const PIN_ITER = 600000;          // PBKDF2 (OWASP 2023: 600 000 con SHA-256)
export const PASS_ITER = 600000;
const nacl = () => globalThis.nacl;
const subtle = () => globalThis.crypto.subtle;

export const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export const unb64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
export const b64u = u8 => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return unb64(s); };
export const hex = u8 => [...u8].map(x => x.toString(16).padStart(2, '0')).join('');
export const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
export const rnd = n => globalThis.crypto.getRandomValues(new Uint8Array(n));
export const sha256 = async u8 => new Uint8Array(await subtle().digest('SHA-256', u8));
export const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function aesEnc(key32, plain, aad = new Uint8Array(0)) {
  const iv = rnd(12), k = await subtle().importKey('raw', key32, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, k, plain));
  return cat(iv, ct);
}
export async function aesDec(key32, blob, aad = new Uint8Array(0)) {
  const k = await subtle().importKey('raw', key32, 'AES-GCM', false, ['decrypt']);
  try { return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: aad, tagLength: 128 }, k, blob.subarray(12))); }
  catch { throw new Error('No se pudo descifrar (clave o PIN incorrectos, o el archivo fue alterado).'); }
}
export async function kdf(secret, salt, iter, info = '') {
  const base = await subtle().importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: cat(salt, enc.encode(info)), iterations: iter }, base, 256));
}
export async function hmac(key32, data) {
  const k = await subtle().importKey('raw', key32, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, data));
}

// ---- Firmas Ed25519 ----
export const newSignKeys = () => { const k = nacl().sign.keyPair(); return { pk: b64(k.publicKey), sk: b64(k.secretKey) }; };
export const newBoxKeys = () => { const k = nacl().box.keyPair(); return { pk: b64(k.publicKey), sk: b64(k.secretKey) }; };
export function mkToken(prefix, obj, skB64) {
  const body = enc.encode(JSON.stringify(obj)), sig = nacl().sign.detached(cat(enc.encode(prefix + '.'), body), unb64(skB64));
  return `${prefix}.${b64u(body)}.${b64u(sig)}`;
}
export const cleanTok = t => String(t || '').replace(/\s+/g, '');
export function openToken(tok, prefix, pkB64) {
  const [p, b, s] = cleanTok(tok).split('.');
  if (p !== prefix || !b || !s) throw new Error('Formato de código no reconocido.');
  let body, sig; try { body = unb64u(b); sig = unb64u(s); } catch { throw new Error('Código dañado o incompleto.'); }
  if (!nacl().sign.detached.verify(cat(enc.encode(prefix + '.'), body), sig, unb64(pkB64))) throw new Error('Firma inválida: el código es falso o fue alterado.');
  return JSON.parse(dec.decode(body));
}
export function peekToken(tok, prefix) { // lee SIN verificar (solo para saber qué clave usar); nunca confiar en esto
  const [p, b] = cleanTok(tok).split('.'); if (p !== prefix || !b) throw new Error('Formato de código no reconocido.');
  return JSON.parse(dec.decode(unb64u(b)));
}
// ---- Cajas selladas X25519 (cifrado hacia una clave pública) ----
export function sealTo(pkB64, plain) {
  const e = nacl().box.keyPair(), n = rnd(24), ct = nacl().box(plain, n, unb64(pkB64), e.secretKey);
  return cat(e.publicKey, n, ct);
}
export function openSeal(blob, skB64) {
  const r = nacl().box.open(blob.subarray(56), blob.subarray(32, 56), blob.subarray(0, 32), unb64(skB64));
  if (!r) throw new Error('No se pudo abrir (no es para esta clave).'); return r;
}
export const fingerprint = async pkB64 => { const h = hex(await sha256(unb64(pkB64))).slice(0, 12).toUpperCase(); return h.match(/.{4}/g).join('-'); };

// ---- PIN de evaluación (12 caracteres, 60 bits) ----
const AL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function genPin() { const r = rnd(12); let s = ''; for (const x of r) s += AL[x % 32]; return s; }
export const fmtPin = p => p.match(/.{1,4}/g).join('-');
export const normPin = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const uuid = () => hex(rnd(12));

// ---- Almacén cifrado con frase (llavero del administrador / llaves del aplicador) ----
export async function sealJSON(obj, pass) {
  const salt = rnd(16), key = await kdf(pass, salt, PASS_ITER, 'KS1');
  const ct = await aesEnc(key, enc.encode(JSON.stringify(obj)), enc.encode('KS1'));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: PASS_ITER, salt: b64(salt), ct: b64(ct) };
}
export async function unsealJSON(box, pass) {
  const key = await kdf(pass, unb64(box.salt), box.iter || PASS_ITER, 'KS1');
  return JSON.parse(dec.decode(await aesDec(key, unb64(box.ct), enc.encode('KS1'))));
}

// ---- Paquetes de forma (EVP1) y claves de respuesta (EVK1) ----
const u32 = n => new Uint8Array([n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255]);
export async function buildPack(ck, formId, meta, audios = {}) {
  const names = Object.keys(audios), idx = {}; let off = 0;
  for (const n of names) { idx[n] = [off, audios[n].length]; off += audios[n].length; }
  const hdr = enc.encode(JSON.stringify({ ...meta, audio: idx }));
  const body = cat(u32(hdr.length), hdr, ...names.map(n => audios[n]));
  return cat(enc.encode('EVP1'), await aesEnc(ck, body, enc.encode('EVP1|' + formId)));
}
export async function openPack(ck, formId, file) {
  if (dec.decode(file.subarray(0, 4)) !== 'EVP1') throw new Error('No es un paquete de forma válido.');
  const body = await aesDec(ck, file.subarray(4), enc.encode('EVP1|' + formId));
  const hl = (body[0] << 24 | body[1] << 16 | body[2] << 8 | body[3]) >>> 0, hdr = JSON.parse(dec.decode(body.subarray(4, 4 + hl))), base = 4 + hl;
  return { hdr, audio: n => { const e = hdr.audio[n]; return e ? body.subarray(base + e[0], base + e[0] + e[1]) : null; } };
}
export async function buildKey(ak, formId, obj) { return cat(enc.encode('EVK1'), await aesEnc(ak, enc.encode(JSON.stringify(obj)), enc.encode('EVK1|' + formId))); }
export async function openKey(ak, formId, file) {
  if (dec.decode(file.subarray(0, 4)) !== 'EVK1') throw new Error('No es un archivo de claves válido.');
  return JSON.parse(dec.decode(await aesDec(ak, file.subarray(4), enc.encode('EVK1|' + formId))));
}
export const packHash = async file => hex(await sha256(file)).slice(0, 32);

// ---- v0.4: datos de evaluación en BLOQUES UNIFORMES (EVC2) ----
// Cada forma se cifra con su propia clave (ck) y se parte en bloques de tamaño FIJO (CH bytes). Todos los archivos públicos
// miden exactamente lo mismo, tienen nombre aleatorio y se mezclan con bloques señuelo (bytes aleatorios, indistinguibles).
// Qué bloques forman cada forma, y su clave, solo viajan dentro del código de evaluación, cifrados con el PIN.
export const CH = 262144;                     // 256 KiB por bloque (archivo público)
const PIECE = CH - 28;                        // 12 IV + 16 etiqueta GCM
export const chunkName = () => hex(rnd(12));  // 24 hex, sin relación con la forma
export async function sealForm(ck, meta, audios = {}) {
  const names = Object.keys(audios), idx = {}; let off = 0;
  for (const n of names) { idx[n] = [off, audios[n].length]; off += audios[n].length; }
  const hdr = enc.encode(JSON.stringify({ ...meta, audio: idx }));
  const body = cat(enc.encode('EVF2'), u32(hdr.length), hdr, ...names.map(n => audios[n]));
  const k = Math.ceil((body.length + 4) / PIECE), plain = new Uint8Array(k * PIECE); plain.set(u32(body.length)); plain.set(body, 4);
  const out = []; for (let i = 0; i < k; i++) out.push(await aesEnc(ck, plain.subarray(i * PIECE, (i + 1) * PIECE), enc.encode(`EVC2|${i}|${k}`)));
  return out; // k bloques de CH bytes
}
export async function openForm(ck, chunks) {
  const k = chunks.length, parts = [];
  for (let i = 0; i < k; i++) { if (!chunks[i] || chunks[i].length !== CH) throw new Error('Datos de evaluación incompletos o alterados.'); parts.push(await aesDec(ck, chunks[i], enc.encode(`EVC2|${i}|${k}`))); }
  const plain = cat(...parts), len = (plain[0] << 24 | plain[1] << 16 | plain[2] << 8 | plain[3]) >>> 0, body = plain.subarray(4, 4 + len);
  if (dec.decode(body.subarray(0, 4)) !== 'EVF2') throw new Error('Datos de evaluación inválidos.');
  const hl = (body[4] << 24 | body[5] << 16 | body[6] << 8 | body[7]) >>> 0, hdr = JSON.parse(dec.decode(body.subarray(8, 8 + hl))), base = 8 + hl;
  return { hdr, audio: n => { const e = hdr.audio[n]; return e ? body.subarray(base + e[0], base + e[0] + e[1]) : null; } };
}
export const decoyChunk = () => { const o = new Uint8Array(CH); for (let i = 0; i < CH; i += 65536) globalThis.crypto.getRandomValues(o.subarray(i, i + 65536)); return o; };
// JSON con relleno a longitud fija (el tamaño no revela cuántos bloques tiene la forma).
export function padJSON(obj, size) { const b = enc.encode(JSON.stringify(obj)); const n = Math.max(size, Math.ceil((b.length + 4) / size) * size), o = new Uint8Array(n); o.set(u32(b.length)); o.set(b, 4); globalThis.crypto.getRandomValues(o.subarray(4 + b.length)); return o; }
export function unpadJSON(u8) { const l = (u8[0] << 24 | u8[1] << 16 | u8[2] << 8 | u8[3]) >>> 0; return JSON.parse(dec.decode(u8.subarray(4, 4 + l))); }
// Contenedor .evd (para pasar datos sin internet): 'EVD2' + n + n × (nombre 12 B + bloque CH B). Nombre neutro, sin forma.
export function packEVD(entries) { const parts = [enc.encode('EVD2'), u32(entries.length)]; for (const [name, b] of entries) { const nb = new Uint8Array(name.match(/../g).map(x => parseInt(x, 16))); parts.push(nb, b); } return cat(...parts); }
export function unpackEVD(u8) { if (dec.decode(u8.subarray(0, 4)) !== 'EVD2') throw new Error('Archivo de datos inválido.'); const n = (u8[4] << 24 | u8[5] << 16 | u8[6] << 8 | u8[7]) >>> 0, out = []; let p = 8; for (let i = 0; i < n; i++) { if (p + 12 + CH > u8.length) throw new Error('Archivo de datos inválido.'); out.push([hex(u8.subarray(p, p + 12)), u8.slice(p + 12, p + 12 + CH)]); p += 12 + CH; } return out; }
