// Perfiles de PERSONAL (v0.4), con llaves propias en el dispositivo y código emitido por la Administración:
// · aplicador: recibe resultados de las evaluaciones donde lo designen y entrega acuses (no emite, no ve forma ni calificación).
// · directora: SOLO CONSULTA de todas las secciones con el paquete que le envía la Administración; no modifica ni genera códigos;
//   nunca recibe formas, PIN ni códigos de evaluación.
// · piloto: prueba del dispositivo con reactivos neutros de funcionamiento (no es práctica ni evaluación; no usa formas).
// Todo lo que hacen queda en la bitácora encadenada del dispositivo, que se exporta sellada para la Administración.
import * as C from './crypto.js'; import * as P from './protocol.js'; import * as DB from './db.js';
import { h, mount, btn, card, toast, field, fmtDT, table } from './util.js';
import { resultadosUI, tokenBox, datosUI, bitacoraUI } from './common.js';
const head = (t, s, back, extra) => h('header', null, h('div', null, h('b', null, t), h('span', null, s)), extra, h('button', { class: 'ico', onclick: back, title: 'Inicio' }, '⌂'));
const KV = rol => rol === 'aplicador' ? 'apl' : 'per_' + rol;
const TIT = { aplicador: 'Docente aplicador', directora: 'Directora · solo consulta', piloto: 'Usuario piloto' };
export const aplicador = (root, back) => personal(root, back, 'aplicador');
export const directora = (root, back) => personal(root, back, 'directora');
export const piloto = (root, back) => personal(root, back, 'piloto');
export async function personal(root, back, rol) {
  DB.setActor('—', rol); const box = await DB.get('kv', KV(rol));
  if (!box) return setup(root, back, rol);
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  mount(root, head(TIT[rol], 'Acceso', back), h('main', null, card(h('p', { class: 'mini' }, 'Tus llaves están cifradas en este dispositivo.'), field('Frase de acceso', pass), btn('Entrar', async () => { try { const s = await C.unsealJSON(box, pass.value); sesion(root, back, s, pass.value, rol); } catch { await DB.logEv('acceso_fallido', { rol }); toast('Frase incorrecta.'); } }, 'big'),
    btn('Olvidé mi frase / empezar de nuevo', async () => { if (confirm('Se borrarán tus llaves de este dispositivo y necesitarás un código nuevo. ¿Continuar?')) { await DB.logEv('reiniciar_llaves', { rol }); await DB.del('kv', KV(rol)); personal(root, back, rol); } }, 'ghost sm'))));
}
function setup(root, back, rol) {
  const nm = h('input', { placeholder: 'Nombre y grado' }), p1 = h('input', { type: 'password' }), p2 = h('input', { type: 'password' });
  mount(root, head(TIT[rol], 'Primer uso', back), h('main', null, card(h('h3', null, 'Registrar este dispositivo'), h('p', { class: 'mini' }, 'Se crean llaves propias en este dispositivo. La Administración te emite un código con vigencia, ligado a estas llaves (no sirve en otro equipo).'),
    field('Tu nombre y grado', nm), field('Frase de acceso (mínimo 8 caracteres)', p1), field('Repite la frase', p2), btn('Crear llaves', async () => {
      if (nm.value.trim().length < 5) return toast('Escribe tu nombre.'); if (p1.value.length < 8 || p1.value !== p2.value) return toast('La frase debe tener 8+ caracteres y coincidir.');
      const s = { nm: nm.value.trim(), sign: C.newSignKeys(), box: C.newBoxKeys(), cred: null }; await DB.put('kv', KV(rol), await C.sealJSON(s, p1.value)); DB.setActor(s.nm, rol); await DB.logEv('registro_dispositivo', { rol, huella: await C.fingerprint(s.sign.pk) }); sesion(root, back, s, p1.value, rol);
    }, 'big'))));
}
async function sesion(root, back, s, pass, rol) {
  DB.setActor(s.nm, rol); await DB.logEv('inicio_sesion', { rol });
  let tab = 'mi';
  const persist = async () => DB.put('kv', KV(rol), await C.sealJSON(s, pass));
  const salir = async () => { await DB.logEv('cierre_sesion', { rol }); DB.setActor('—', 'inicio'); back(); };
  const TABS = { aplicador: [['mi', 'Mi código'], ['res', 'Resultados'], ['datos', 'Datos'], ['bit', 'Bitácora']], directora: [['mi', 'Mi código'], ['resumen', 'Resumen'], ['eval', 'Evaluaciones'], ['dres', 'Resultados'], ['per', 'Personal'], ['bit', 'Bitácora']], piloto: [['mi', 'Mi código'], ['prueba', 'Prueba del dispositivo'], ['bit', 'Bitácora']] }[rol];
  async function draw() {
    const revoked = (await DB.get('kv', 'revoked')) || []; const st = s.cred ? P.credStatus(s.cred.core, P.now(), revoked) : 'sin código', vig = st === 'vigente';
    await DB.logEv('vista', { rol, seccion: tab });
    let body;
    if (tab === 'mi') {
      const req = P.mkRequest(s.nm, s); const cr = h('textarea', { class: 'tok', rows: 4, placeholder: 'Pega aquí tu código de personal (AP2.…)' });
      const que = { aplicador: 'Los códigos de evaluación los emite SOLO la Administración. Tú recibes los resultados de las evaluaciones en que te designe y entregas los acuses. No ves la forma ni la calificación.', directora: 'Perfil de SOLO CONSULTA: ves todas las secciones con el paquete de consulta que te envía la Administración. No puedes modificar nada ni generar códigos. Nunca recibes formas, PIN ni códigos de evaluación.', piloto: 'Perfil PILOTO: prueba del dispositivo (pantalla completa, audio máximo 2 veces, incidentes) con reactivos neutros de funcionamiento. No es práctica ni evaluación, no usa formas y no genera resultados.' }[rol];
      body = [card(h('h3', null, s.nm), h('p', null, 'Huella de este dispositivo: ', h('b', { class: 'mono' }, await C.fingerprint(s.sign.pk))), s.cred ? h('p', null, 'Código: ', h('span', { class: 'pill ' + (vig ? 'ok' : 'bad') }, st), ` · del ${fmtDT(s.cred.core.nb)} al ${fmtDT(s.cred.core.ex)}`) : h('p', { class: 'badt' }, 'Aún no tienes código.'), h('p', { class: 'mini' }, que)),
        card(h('h3', null, '1 · Solicita tu código'), h('p', { class: 'mini' }, 'Envía esta solicitud a la Administración (no contiene secretos). Verifica por voz que la huella coincida.'), tokenBox(req, 'Solicitud:', 'solicitud_' + rol + '.txt')),
        card(h('h3', null, '2 · Carga el código que te emitió'), cr, btn('Cargar código', async () => {
          try { const t = cr.value.replace(/\s+/g, ''); const { core } = P.readCred(t, rol); if (core.pk !== s.sign.pk || core.bk !== s.box.pk) throw new Error('Este código fue emitido para otro dispositivo.'); s.cred = { text: t, core }; await persist(); await DB.logEv('cargar_codigo', { rol, id: core.id }); toast('Código cargado'); draw(); } catch (e) { toast(e.message); } }))];
    } else if (tab === 'res') body = [!vig ? card(h('p', { class: 'badt' }, `Tu código está: ${st}. Puedes abrir resultados, pero tus acuses solo valen dentro de la vigencia.`)) : null, await resultadosUI({ boxSk: s.box.sk, issuerSk: s.sign.sk, titulo: 'Resultados de las evaluaciones que recibes' })];
    else if (tab === 'datos') body = [datosUI()];
    else if (tab === 'bit') body = [bitacoraUI()];
    else if (tab === 'prueba') body = [vig ? pruebaCard(root, draw) : card(h('p', { class: 'badt' }, `Tu código está: ${st}. La prueba del dispositivo requiere un código vigente.`))];
    else body = await consulta(tab, s, vig, st, draw);
    mount(root, head(TIT[rol], s.nm, salir), h('nav', { class: 'tabs' }, TABS.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l))), h('main', { class: 'wide' }, body));
  }
  draw();
}
// ---------- Directora: solo consulta ----------
async function consulta(tab, s, vig, st, redraw) {
  const q = await DB.get('kv', 'consulta'); const ta = h('textarea', { class: 'tok', rows: 3, placeholder: 'Pega aquí el paquete de consulta (DQ1.…)' });
  const imp = card(h('h3', null, 'Paquete de consulta'), h('p', { class: 'mini' }, q ? `Información al ${fmtDT(q.ts)}. Pide a la Administración un paquete nuevo para actualizar.` : 'La Administración te envía un paquete de consulta (archivo o texto). Solo puede abrirse en este dispositivo.'), ta,
    h('div', { class: 'row' }, btn('Abrir paquete', async () => { try { if (!vig) throw new Error(`Tu código está: ${st}.`); const d = P.openConsulta(ta.value, s.cred.core, s.box.sk); await DB.put('kv', 'consulta', d); await DB.logEv('importar_consulta', { ts: d.ts }); toast('Paquete de consulta cargado'); redraw(); } catch (e) { toast(e.message); } }, 'sm'),
      h('label', { class: 'btn ghost sm' }, 'Abrir archivo', h('input', { type: 'file', hidden: true, onchange: async e => { const { readText } = await import('./util.js'); ta.value = (await readText(e.target.files[0])).trim(); } }))));
  if (!q) return [imp];
  const ro = h('p', { class: 'mini' }, 'Solo consulta: esta vista no permite modificar, emitir códigos, aprobar formas ni borrar.');
  if (tab === 'resumen') return [imp, card(h('h3', null, 'Resumen'), ro, table(['Concepto', 'Valor'], [['Formas aprobadas ALC / ALCPT (solo cantidad)', `${q.formas.ALC} / ${q.formas.ALCPT}`], ['Códigos de evaluación emitidos', q.emitidos.length], ['Resultados recibidos', q.resultados.length], ['Cerrados por incidentes', q.resultados.filter(r => r.motivo === 'incidentes').length], ['Personal registrado', q.personal.length]]))];
  if (tab === 'eval') return [imp, card(h('h3', null, 'Evaluaciones emitidas'), ro, h('p', { class: 'mini' }, 'No se muestran la forma, el código ni el PIN.'), table(['Evaluación', 'Vigencia', 'Duración', 'Aplicador', 'Estado'], q.emitidos.map(e => [P.etiquetaES(e.ty, e.pa), `${fmtDT(e.nb)} → ${fmtDT(e.ex)}`, e.du + ' min', e.ap || '—', e.estado])))];
  if (tab === 'dres') { const out = h('div'); return [imp, card(h('h3', null, 'Resultados'), ro, table(['Matrícula', 'Nombre', 'Año', 'Grupo', 'Evaluación', '%', 'Calificación', 'Incidentes', 'Cierre', ''], q.resultados.map(r => [r.mat, r.nom, r.an, r.gr, P.etiquetaES(r.ty, r.pa), r.pct ?? 'pendiente', r.cal ?? '', String(r.inc.length), r.motivo || '', r.inc.length ? btn('Evidencia', async () => { await DB.logEv('ver_evidencia', { mat: r.mat }); const { evidenciaCard } = await import('./common.js'); out.replaceChildren(evidenciaCard({ cad: { mat: r.mat, nom: r.nom }, inc: r.inc, motivo: r.motivo })); }, 'sm ghost') : ''])), out)]; }
  return [imp, card(h('h3', null, 'Personal'), ro, table(['Nombre', 'Perfil', 'Vigencia', 'Estado'], q.personal.map(p => [p.nm, P.ROLES[p.rol] || p.rol, `${fmtDT(p.nb)} → ${fmtDT(p.ex)}`, p.estado])))];
}
// ---------- Piloto: prueba del dispositivo (reactivos neutros, nada se guarda ni se envía) ----------
function tono() { const sr = 8000, n = sr * 1.2, b = new DataView(new ArrayBuffer(44 + n * 2)); const w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0))); w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, sr, true); b.setUint32(28, sr * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true); for (let i = 0; i < n; i++) b.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 660 * i / sr) * 8000 * Math.min(1, (n - i) / 800), true); return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' })); }
export const PILOTO_ITEMS = [
  { n: 1, sec: 'L', tp: 'Device check', q: 'Audio check: play the tone (maximum 2 times) and choose «I heard the tone».', o: ['I heard the tone', 'I did not hear anything', 'The sound was distorted', 'The button did not work'], au: 't1' },
  { n: 2, sec: 'L', tp: 'Device check', q: 'Second audio check: play the tone and choose «I heard the tone».', o: ['I heard the tone', 'I did not hear anything', 'The sound was distorted', 'The button did not work'], au: 't1' },
  { n: 3, sec: 'R', tp: 'Device check', q: 'Screen check: choose «Option C».', o: ['Option A', 'Option B', 'Option C', 'Option D'] },
  { n: 4, sec: 'R', tp: 'Device check', q: 'Touch check: choose «Option A».', o: ['Option A', 'Option B', 'Option C', 'Option D'] },
  { n: 5, sec: 'R', tp: 'Device check', q: 'Readability check: can you read all the options without zooming?', o: ['Yes', 'No', 'Only some of them', 'The text is too small'] },
];
function pruebaCard(root, redraw) {
  return card(h('h3', null, 'Prueba del dispositivo (piloto)'), h('p', { class: 'mini' }, 'Recorre el flujo del examen con 5 reactivos NEUTROS de funcionamiento (no son de inglés ni de ninguna forma ALC/ALCPT): pantalla completa obligatoria, bloques con y sin audio, audio máximo 2 veces, orden aleatorio y detección de incidentes (al 3.º se cierra). No se guarda ni se envía ningún resultado; queda solo el registro en la bitácora.'),
    btn('Iniciar prueba del dispositivo', async () => {
      const { runExam } = await import('./exam.js'), { plan } = await import('./order.js'); const url = tono(); const answers = Array(PILOTO_ITEMS.length).fill(-1), plays = {}, inc = [];
      await DB.logEv('prueba_piloto_inicio', {}); const p = await plan(PILOTO_ITEMS, 'piloto|' + C.uuid());
      runExam({ root, meta: { n: PILOTO_ITEMS.length, items: PILOTO_ITEMS }, etiqueta: 'PILOT DEVICE CHECK · NOT AN EXAM', plan: p, answers, plays, maxPlays: 2, deadline: Date.now() + 10 * 60000, getAudio: async () => url, quien: { mat: 'PILOTO', nom: 'Usuario piloto' }, incidentes: inc,
        onIncident: async r => { await DB.logEv('prueba_piloto_incidente', { n: r.n, tipo: r.tipo }); }, onAnswer: () => { }, onPlay: () => { }, onBloque: () => { },
        onSubmit: async motivo => { URL.revokeObjectURL(url); await DB.logEv('prueba_piloto_fin', { motivo, incidentes: inc.length, audio: plays }); const { TIPOS } = await import('./integrity.js');
          mount(root, head('Usuario piloto', 'Resultado de la prueba del dispositivo', redraw), h('main', null, card(h('p', null, h('span', { class: 'pill warn' }, 'PILOTO · NO ES EVALUACIÓN'), ' No se generó resultado ni calificación.'),
            table(['Revisión', 'Resultado'], [['Cierre', ({ incidentes: 'cerrado al 3.er incidente (detección correcta)', tiempo: 'tiempo agotado', cadete: 'entregado' })[motivo] || motivo], ['Incidentes detectados', inc.length ? inc.map(i => TIPOS[i.tipo] || i.tipo).join(' · ') : 'ninguno'], ['Reproducciones de audio', Object.values(plays).join(' / ') || '0'], ['Reactivos respondidos', `${answers.filter(x => x >= 0).length} de ${answers.length}`]]),
            btn('Volver', redraw, 'big')))); } });
    }, 'big'));
}
