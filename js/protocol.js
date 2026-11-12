// Protocolo v0.4 (SIN internet): SOLO evaluaciones formales emitidas por la Administración.
// · Código de evaluación EV2: fija tipo de evaluación + forma + ventana (inicio/fin), duración y reproducciones.
//   Lo que va legible (firmado) NO dice qué forma es: la forma (identificador opaco), su clave y sus bloques de datos van
//   cifrados con una clave derivada del PIN (PBKDF2) y con relleno a longitud fija.
// · Código de aplicador AP2: solo identidad + vigencia (ya no lleva lista de formas). El aplicador NO emite exámenes:
//   recibe resultados de las evaluaciones donde la Administración lo designó y entrega acuses.
// · Resultado RS2: la forma va sellada SOLO para la Administración (campo fa); el aplicador no la ve.
import * as C from './crypto.js';
import { ADMIN_PK, ADMIN_BOX_PK } from './config.js';
const now = () => Math.floor(Date.now() / 1000);
export const MAX_SKEW = 300; // tolerancia de reloj (s)
const PAY = 1024;           // bytes fijos del bloque cifrado del código

// Tipos de evaluación permitidos (no hay práctica, demo ni modo libre).
export const TIPOS_EVAL = {
  ALC_P: { clase: 'ALC', es: 'ALC · Evaluación parcial', en: 'ALC Partial Exam' },
  ALCPT_D: { clase: 'ALCPT', es: 'ALCPT · Diagnóstico', en: 'ALCPT Diagnostic Test' },
  ALCPT_F: { clase: 'ALCPT', es: 'ALCPT · Final', en: 'ALCPT Final Test' },
  ALCPT_S: { clase: 'ALCPT', es: 'ALCPT · Seguimiento (según lo ordenado)', en: 'ALCPT Follow-up Test' },
};
const ORD = ['', '1st', '2nd', '3rd'], ORD_ES = ['', '1.ª', '2.ª', '3.ª'];
export const etiquetaEN = (ty, pa) => { const t = TIPOS_EVAL[ty]; if (!t) return 'English Exam'; return ty === 'ALC_P' && pa ? `ALC ${ORD[pa]} Partial Exam` : t.en; };
export const etiquetaES = (ty, pa) => { const t = TIPOS_EVAL[ty]; if (!t) return '—'; return ty === 'ALC_P' && pa ? `ALC · ${ORD_ES[pa]} evaluación parcial` : t.es; };

// ---- Solicitud de alta de aplicador (la genera el dispositivo del docente) ----
export const mkRequest = (nm, keys) => C.mkToken('SOL1', { nm, pk: keys.sign.pk, bk: keys.box.pk, ts: now() }, keys.sign.sk);
export function readRequest(tok) { const p = C.peekToken(tok, 'SOL1'); return { ...C.openToken(tok, 'SOL1', p.pk) }; }

// ---- Código de aplicador (identidad + vigencia; sin formas) ----
// v0.4: el mismo código sirve para los perfiles de personal: aplicador, directora (solo consulta) y piloto (prueba del dispositivo).
export const ROLES = { aplicador: 'Docente aplicador', directora: 'Directora (solo consulta)', piloto: 'Usuario piloto (prueba del dispositivo)' };
export function issueCred(adm, req, { nb, ex, rol = 'aplicador' }) {
  if (!(ex > nb)) throw new Error('La vigencia es inválida.');
  if (!ROLES[rol]) throw new Error('Perfil inválido.');
  const core = { t: 'AP', v: 2, id: C.uuid(), rol, nm: req.nm, pk: req.pk, bk: req.bk, nb, ex };
  return { core, token: C.mkToken('AP2', core, adm.sign.sk) };
}
export function readCred(full, rol) { const core = C.openToken(C.cleanTok(full), 'AP2', ADMIN_PK); if (rol && (core.rol || 'aplicador') !== rol) throw new Error(`Este código es para el perfil «${ROLES[core.rol] || core.rol}», no para este.`); return { core }; }
export function credStatus(core, t = now(), revoked = []) {
  if (revoked.includes(core.id)) return 'revocado';
  if (t < core.nb - MAX_SKEW) return 'aún no vigente';
  if (t > core.ex + MAX_SKEW) return 'vencido';
  return 'vigente';
}

// ---- Código de evaluación (SOLO la Administración) ----
// form: {s: id opaco, ck: b64, ch: [nombres de bloque], n}; apl (opcional): {id, pk, bk} del aplicador que recibe.
export async function issueEval(adm, { ty, pa, form, nb, ex, du, pl, apl }) {
  if (!TIPOS_EVAL[ty]) throw new Error('Tipo de evaluación inválido.');
  if (!form || !form.s || !form.ck || !form.ch?.length) throw new Error('Forma inválida.');
  if (!(ex > nb)) throw new Error('La vigencia termina antes de empezar.');
  const id = C.uuid(), pin = C.genPin(), salt = C.rnd(16);
  const kek = await C.kdf(pin, salt, C.PIN_ITER, 'EV2|' + id);
  const wk = await C.aesEnc(kek, C.padJSON({ s: form.s, ck: form.ck, ch: form.ch, n: form.n }, PAY), C.enc.encode('EV2K|' + id));
  const body = { t: 'EV', v: 2, id, ty, pa: ty === 'ALC_P' ? (pa || null) : null, nb, ex, du, pl, is: adm.sign.pk, ak: apl ? [adm.sign.pk, apl.pk] : [adm.sign.pk], rb: apl ? [adm.box.pk, apl.bk] : [adm.box.pk], ap: apl ? apl.id : null, sa: C.b64(salt), wk: C.b64(wk) };
  return { id, pin, token: C.mkToken('EV2', body, adm.sign.sk), body };
}
export function verifyEval(tok, { t = now(), revoked = [], lastSeen = 0 } = {}) {
  const p = C.cleanTok(tok).split('.')[0];
  if (p === 'EV1') throw new Error('Este código es de una versión anterior de la app y ya no es válido.');
  const body = C.openToken(tok, 'EV2', ADMIN_PK);   // lanza si la firma es falsa o no es de la Administración
  if (body.is !== ADMIN_PK || !TIPOS_EVAL[body.ty]) throw new Error('Emisor desconocido.');
  if (revoked.includes(body.id) || (body.ap && revoked.includes(body.ap))) throw new Error('Este código fue revocado.');
  if (lastSeen && t < lastSeen - MAX_SKEW) throw new Error('El reloj del dispositivo parece haberse atrasado. Corrige fecha y hora.');
  if (t < body.nb - MAX_SKEW) throw new Error('Este código todavía no está vigente.');
  if (t > body.ex + MAX_SKEW) throw new Error('Este código venció.');
  return body;
}
export async function unlockEval(body, pin) {
  const kek = await C.kdf(C.normPin(pin), C.unb64(body.sa), C.PIN_ITER, 'EV2|' + body.id);
  let raw; try { raw = await C.aesDec(kek, C.unb64(body.wk), C.enc.encode('EV2K|' + body.id)); } catch { throw new Error('PIN incorrecto.'); }
  const pay = C.unpadJSON(raw); return { pay, ck: C.unb64(pay.ck), kek };
}

// ---- Resultado del cadete (sellado hacia la Administración y, si se designó, el aplicador) ----
export async function sealResult(body, kek, pay, r) {
  const fa = C.b64(C.sealTo(body.rb[0], C.enc.encode(JSON.stringify({ s: pay.s, n: pay.n })))); // la forma: SOLO la Administración
  const plain = { t: 'RS', v: 2, id: C.uuid(), ev: body.id, ty: body.ty, pa: body.pa, ...r, fa };
  plain.mc = C.b64(await C.hmac(kek, C.enc.encode(JSON.stringify(plain))));
  const raw = C.enc.encode(JSON.stringify(plain));
  return { id: plain.id, token: 'RS2.' + C.b64u(C.enc.encode(JSON.stringify({ ev: body.id, id: plain.id, s: body.rb.map(pk => C.b64(C.sealTo(pk, raw))) }))) };
}
export function openResult(tok, boxSk) {
  const [p, b] = C.cleanTok(tok).split('.'); if (p !== 'RS2' || !b) throw new Error('Formato de resultado no reconocido.');
  const env = JSON.parse(C.dec.decode(C.unb64u(b)));
  for (const s of env.s) { try { return { env, r: JSON.parse(C.dec.decode(C.openSeal(C.unb64(s), boxSk))) }; } catch { } }
  throw new Error('Este resultado no está dirigido a ti (otro aplicador o evaluación).');
}
export function formaDe(r, admBoxSk) { try { return JSON.parse(C.dec.decode(C.openSeal(C.unb64(r.fa), admBoxSk))); } catch { return null; } }
export async function checkMac(r, kek) {
  const { mc, ...rest } = r; const m = C.b64(await C.hmac(kek, C.enc.encode(JSON.stringify(rest)))); return m === mc;
}
// ---- Acuse de recibo (lo firma la Administración o el aplicador designado) ----
export const mkAck = (issuerSk, ev, id) => C.mkToken('AC1', { ev, id, ts: now() }, issuerSk);
export function readAckAny(tok, pks) { for (const pk of pks || []) { try { return C.openToken(tok, 'AC1', pk); } catch { } } throw new Error('Formato de acuse inválido.'); }
// ---- Boletín de revocación (códigos de evaluación o de aplicador) ----
export const mkRevocation = (admSk, ids) => C.mkToken('RV1', { ids, ts: now() }, admSk);
export const readRevocation = tok => C.openToken(tok, 'RV1', ADMIN_PK);
// ---- Bitácora de un dispositivo para la Administración (BT1): sellada, solo la Administración la abre ----
export const mkBitacora = (dev, regs) => 'BT1.' + C.b64u(C.enc.encode(JSON.stringify({ dev, n: regs.length, s: C.b64(C.sealTo(ADMIN_BOX_PK, C.enc.encode(JSON.stringify(regs)))) })));
export function openBitacora(tok, admBoxSk) { const [p, b] = C.cleanTok(tok).split('.'); if (p !== 'BT1' || !b) throw new Error('No es una bitácora.'); const env = JSON.parse(C.dec.decode(C.unb64u(b))); return { dev: env.dev, regs: JSON.parse(C.dec.decode(C.openSeal(C.unb64(env.s), admBoxSk))) }; }
// ---- Paquete de consulta para la Directora (DQ1): firmado por la Administración y sellado a su dispositivo. Sin formas, PIN ni códigos.
export function mkConsulta(adm, dirCore, data) { const raw = C.enc.encode(JSON.stringify({ ...data, para: dirCore.id, ts: now() })); const s = C.b64(C.sealTo(dirCore.bk, raw)); return C.mkToken('DQ1', { para: dirCore.id, ts: now(), s }, adm.sign.sk); }
export function openConsulta(tok, cred, boxSk) { const b = C.openToken(tok, 'DQ1', ADMIN_PK); if (b.para !== cred.id) throw new Error('Este paquete de consulta es para otro dispositivo.'); return JSON.parse(C.dec.decode(C.openSeal(C.unb64(b.s), boxSk))); }
export { now, ADMIN_BOX_PK };
