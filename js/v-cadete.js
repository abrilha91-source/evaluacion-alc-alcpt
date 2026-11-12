// Flujo del CADETE (versión SIN internet). v0.3: desde que el cadete entra, TODO va en inglés (instrucciones, botones, avisos,
// errores). Lo interno (bitácora, evidencia para el Administrador) sigue en español.
import * as C from './crypto.js'; import * as P from './protocol.js'; import * as DB from './db.js';
import { h, mount, btn, card, toast, field, fmtDT, download, setLang } from './util.js'; import { runExam } from './exam.js'; import { plan, huellaOrden } from './order.js';
import { getChunks, importarDatos, prepararSinInternet, tokenBox } from './common.js'; import { CAMPOS, NO_SE_RECOGE, DESTINO_OFFLINE, FINALIDAD, CAMPOS_EN, NO_SE_RECOGE_EN, DESTINO_OFFLINE_EN, FINALIDAD_EN } from './aviso.js';
import { enErr } from './en.js'; import { etiquetaEN } from './protocol.js'; import { reglas } from './reglas.js';

export function avisoCard(destino = DESTINO_OFFLINE) { // versión en español (pantalla de inicio / personal)
  return card(h('h3', null, 'Aviso de privacidad'), h('p', null, FINALIDAD), h('p', null, h('b', null, 'Datos que se guardan:')), h('ul', null, CAMPOS.map(([a, b]) => h('li', null, h('b', null, a + '. '), b))), h('p', null, NO_SE_RECOGE), h('p', null, h('b', null, 'Destino: '), destino));
}
export function avisoCardEN(destino = DESTINO_OFFLINE_EN) {
  return card(h('h3', null, 'Privacy notice'), h('p', null, FINALIDAD_EN), h('p', null, h('b', null, 'Data that is stored:')), h('ul', null, CAMPOS_EN.map(([a, b]) => h('li', null, h('b', null, a + '. '), b))), h('p', null, NO_SE_RECOGE_EN), h('p', null, h('b', null, 'Where it goes: '), destino));
}
const ST = { 'en curso': 'in progress', acusado: 'submitted and confirmed', entregado: 'SUBMISSION PENDING confirmation' };
export async function cadete(root, back0) {
  setLang('en'); DB.setActor('— (cadete sin identificar)', 'cadete'); const back = () => { setLang('es'); DB.setActor('—', 'inicio'); back0(); };
  const att = (await DB.all('attempts')).map(x => x[1]).sort((a, b) => b.t0 - a.t0);
  const pin = h('input', { placeholder: 'XXXX-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters' });
  const ta = h('textarea', { class: 'tok', rows: 3, placeholder: 'Paste the exam code here (EV2.…)' });
  const go = async () => { try { await paso(root, ta.value, pin.value, back); } catch (e) { toast(enErr(e)); } };
  mount(root, h('header', null, h('div', null, h('b', null, 'Cadet'), h('span', null, 'Take an exam')), h('button', { class: 'ico', onclick: back, title: 'Home' }, '⌂')),
    h('main', null, card(h('h2', null, 'Exam code'), h('p', { class: 'mini' }, 'Your proctor gives you a code (text or QR) and, at exam time, a 12-character PIN.'), field('Code', ta),
      h('div', { class: 'row' }, btn('Scan QR', async () => { const { escanear } = await import('./qr.js'); escanear(t => { ta.value = t; }).catch(e => toast(enErr(e))); }, 'ghost sm')), field('PIN', pin), btn('Open exam', go, 'big')),
      att.length ? card(h('h3', null, 'My exams on this device'), ...att.map(a => h('div', { class: 'rev' }, h('b', null, `${etiquetaEN(a.ty, a.pa)} · ${a.cad.mat}`), h('p', { class: 'mini' }, `${fmtDT(Math.floor(a.t0 / 1000))} · `, h('span', { class: 'pill ' + (a.estado === 'acusado' ? 'ok' : a.estado === 'en curso' ? 'warn' : 'bad') }, ST[a.estado] || ST.entregado)),
        a.estado !== 'en curso' ? btn(a.estado === 'acusado' ? 'View receipt' : 'Submit / resend', () => entrega(root, a, back), 'sm ghost') : null))) : null,
      avisoCardEN()));
}
async function paso(root, code, pinRaw, back) {
  const lastSeen = (await DB.get('kv', 'lastSeen')) || 0, revoked = (await DB.get('kv', 'revoked')) || [], t = P.now();
  let body; try { body = P.verifyEval(code, { t, revoked, lastSeen }); } catch (e) { await DB.logEv('codigo_rechazado', { motivo: String(e.message).slice(0, 80) }); throw e; } await DB.put('kv', 'lastSeen', Math.max(lastSeen, t));
  let u; try { u = await P.unlockEval(body, pinRaw); } catch (e) { await DB.logEv('acceso_fallido', { rol: 'cadete', ev: body.id, motivo: 'PIN' }); throw e; } const { pay, ck, kek } = u; await DB.logEv('abrir_codigo', { ev: body.id, ty: body.ty, pa: body.pa });
  const chunks = await getChunks(pay.ch);
  if (!chunks) return pedirDatos(root, code, pinRaw, back);
  const form = await C.openForm(ck, chunks);
  identificacion(root, body, kek, pay, form, back, code);
}
function pedirDatos(root, code, pin, back) { // mensaje neutro: no dice qué forma ni qué archivo
  const st = h('p', { class: 'mini' }), retry = async () => { try { await paso(root, code, pin, back); } catch (x) { toast(enErr(x)); } };
  mount(root, h('header', null, h('div', null, h('b', null, 'Exam data missing')), h('button', { class: 'ico', onclick: back, title: 'Home' }, '⌂')), h('main', null, card(h('p', null, 'The code and PIN are valid, but the exam data is not saved on this device. Connect to the internet and tap «Download exam data», or ask your proctor for the exam data file (.evd) and import it here.'),
    h('div', { class: 'row' }, btn('Download exam data', async () => { const r = await prepararSinInternet((i, n) => st.textContent = `Downloading ${i}/${n}…`); st.textContent = r.n ? `${r.ok} of ${r.n} saved.` : 'No connection.'; if (r.ok) retry(); }),
      h('label', { class: 'btn ghost' }, 'Import exam data file (.evd)', h('input', { type: 'file', accept: '.evd', hidden: true, onchange: async e => { const n = await importarDatos(e.target.files); if (n) retry(); } }))), st)));
}
function identificacion(root, body, kek, pay, pack, back, code0) {
  const LAB = etiquetaEN(body.ty, body.pa);
  const v = { mat: '', nom: '', an: '1', gr: '' }, ok = h('input', { type: 'checkbox' });
  const cont = async () => {
    v.mat = v.mat.trim().toUpperCase(); v.nom = v.nom.trim(); v.gr = v.gr.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(v.mat)) return toast('Invalid cadet ID (4 to 20 letters or numbers).'); if (v.nom.length < 5 || v.nom.length > 80) return toast('Type your full name.'); if (!ok.checked) return toast('You must accept the privacy notice.');
    const key = body.id + '|' + v.mat; let a = await DB.get('attempts', key);
    if (a && a.estado !== 'en curso') return entrega(root, a, back);
    DB.setActor(`${v.nom} (${v.mat})`, 'cadete'); await DB.logEv('inicio_sesion', { rol: 'cadete', ev: body.id });
    if (!a) { a = { key, ev: body.id, ty: body.ty, pa: body.pa, ak: body.ak, is: body.is, token: null, evTok: code0, cad: v, t0: Date.now(), du: body.du, pl: body.pl, an: Array(pack.hdr.n).fill(-1), plays: {}, sal: 0, estado: 'en curso', dv: C.uuid(), rb: body.rb }; await DB.put('attempts', key, a); await DB.logEv('inicio_examen', { ev: body.id, mat: v.mat }); }
    examen(root, body, kek, pay, pack, a, back);
  };
  mount(root, h('header', null, h('div', null, h('b', null, LAB), h('span', null, 'Identification')), h('button', { class: 'ico', onclick: back, title: 'Home' }, '⌂')),
    h('main', null, card(h('p', null, h('span', { class: 'pill ok' }, 'Valid code'), ` ${LAB} · valid until ${fmtDT(body.ex)} · ${body.du} min`),
      field('Cadet ID', h('input', { onchange: e => v.mat = e.target.value, autocomplete: 'off' })), field('Full name', h('input', { onchange: e => v.nom = e.target.value })),
      h('div', { class: 'g2' }, field('Year', h('select', { onchange: e => v.an = e.target.value }, ['1', '2', '3', '4'].map(x => h('option', null, x)))), field('Group', h('input', { onchange: e => v.gr = e.target.value }))),
      reglas(body.du, body.pl, 'You will not see your grade if you submit normally; your proctor gives it to you.'),
      h('label', { class: 'chk' }, ok, ' I have read and accept the privacy notice'), btn('Start exam', cont, 'big')), avisoCardEN()));
}
export async function abrir(root, back, code, pinRaw) { setLang('en'); return paso(root, code, pinRaw, () => { setLang('es'); back(); }); }
async function examen(root, body, kek, pay, pack, a, back) {
  const urls = {}; const getAudio = async name => { if (urls[name]) return urls[name]; const b = pack.audio(name); if (!b) return null; return urls[name] = URL.createObjectURL(new Blob([b], { type: 'audio/mpeg' })); };
  const p = await plan(pack.hdr.items, `${a.ev}|${a.cad.mat}|${a.dv}`); a.inc ||= []; a.ord = await huellaOrden(p); const save = () => DB.put('attempts', a.key, a);
  runExam({ root, meta: pack.hdr, etiqueta: etiquetaEN(body.ty, body.pa), plan: p, bloque: a.blk, onBloque: b => { a.blk = b; save(); DB.logEv('bloque_inicial', { ev: a.ev, bloque: b }); }, answers: a.an, plays: a.plays, maxPlays: body.pl, deadline: a.t0 + a.du * 60000, getAudio, quien: a.cad,
    incidentes: a.inc, onIncident: async r => { a.sal = a.inc.length; await save(); await DB.logEv('incidente', { ev: a.ev, n: r.n, tipo: r.tipo }); },
    onAnswer: () => save(), onPlay: () => save(),
    onSubmit: async motivo => {
      const t1 = Date.now(), an = a.an.map(x => x < 0 ? '-' : 'ABCD'[x]).join(''); await DB.logEv('cierre_examen', { ev: a.ev, motivo, incidentes: a.inc.length });
      const bt = (await DB.logAll()).filter(x => x.det && x.det.ev === a.ev).slice(-60); // su bitácora del intento viaja sellada dentro del resultado
      const inc = a.inc.map(x => ({ n: x.n, tipo: x.tipo, t: x.t, pos: x.pos, item: x.item, img: x.img && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.img) ? x.img : null }));
      const r = await P.sealResult(body, kek, pay, { cad: a.cad, an, t0: a.t0, t1, sal: a.inc.length, dv: a.dv, motivo, blk: a.blk || null, ord: a.ord, pl: a.plays, inc, bt });
      a.token = r.token; a.rid = r.id; a.estado = 'entregado'; a.t1 = t1; a.motivo = motivo; await save(); await DB.logEv('entrega_examen', { ev: a.ev, motivo });
      Object.values(urls).forEach(u => URL.revokeObjectURL(u)); entrega(root, a, back);
    } });
}
function entrega(root, a, back) {
  const ackIn = h('textarea', { class: 'tok', rows: 2, placeholder: 'Paste the receipt here (AC1.…)' });
  mount(root, h('header', null, h('div', null, h('b', null, etiquetaEN(a.ty, a.pa)), h('span', null, 'Submission')), h('button', { class: 'ico', onclick: back, title: 'Home' }, '⌂')),
    h('main', null, card(a.estado === 'acusado' ? h('p', null, h('span', { class: 'pill ok' }, 'SUBMITTED AND CONFIRMED'), ' Your proctor received your result.') : h('p', null, h('span', { class: 'pill bad' }, 'SUBMISSION PENDING'), ' Your exam is finished, but it only counts as submitted when your proctor gives you the receipt. Show them the QR code or send them the file.'),
      a.motivo === 'incidentes' ? h('p', { class: 'badt' }, `Your exam was CLOSED after ${(a.inc || []).length} incidents (switching apps or windows, leaving full screen, other apps visible, screenshot or translation). It was submitted with your answers and the evidence of each incident. Your grade is issued by the proctor when they open your result: this device does not have the answer key.`) : null,
      a.motivo === 'tiempo' ? h('p', { class: 'badt' }, 'Time was up: your exam was submitted with your answers.') : null,
      h('p', { class: 'mini' }, `${a.cad.nom} · ${a.cad.mat} · finished ${new Date(a.t1).toLocaleString('en-US')}`),
      tokenBox(a.token, 'Encrypted result (only the proctor and the Administrator can open it):', `resultado_${a.cad.mat}.evres`),
      btn('Download .evres file', () => download(`resultado_${a.cad.mat}.evres`, a.token, 'text/plain'), 'ghost')),
      a.estado !== 'acusado' ? card(h('h3', null, 'Receipt'), ackIn, btn('Verify receipt', async () => { try { const k = P.readAckAny(ackIn.value, a.ak || [a.is]); if (k.ev !== a.ev || k.id !== a.rid) throw new Error('Este acuse no corresponde a tu resultado.'); a.estado = 'acusado'; DB.logEv('acuse_recibido', { ev: a.ev }); await DB.put('attempts', a.key, a); toast('Submission confirmed'); entrega(root, a, back); } catch (e) { toast(enErr(e)); } })) : null));
}
