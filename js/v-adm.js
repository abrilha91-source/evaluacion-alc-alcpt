import * as C from './crypto.js'; import * as P from './protocol.js'; import * as DB from './db.js';
import { h, mount, btn, card, toast, field, fmtDT, toLocalInput, fromLocalInput, table, download, readText, copy } from './util.js';
import { emitirEval, emitidosUI, resultadosUI, tokenBox, datosUI, bitacoraAdminUI, datosConsulta } from './common.js'; import { newDraftUI } from './pdfimport.js';
import { ADMIN_PK } from './config.js';

const head = (t, s, back, ex) => h('header', null, h('div', null, h('b', null, t), h('span', null, s)), ex, h('button', { class: 'ico', onclick: back, title: 'Inicio' }, '⌂'));
export async function admin(root, back) {
  DB.setActor('—', 'admin');
  const box = await DB.get('kv', 'adm');
  if (!box) {
    const pass = h('input', { type: 'password' });
    return mount(root, head('Administración', 'Primer uso', back), h('main', null, card(h('h3', null, 'Importar llavero del Administrador'), h('p', { class: 'mini' }, 'El llavero (admin_keystore.enc.json) contiene la clave privada: solo se importa en el dispositivo de la Cap. Abril Mejía. Queda cifrado con tu frase.'),
      h('label', null, 'Archivo del llavero', h('input', { type: 'file', accept: '.json', id: 'ksf' })), field('Frase del llavero', pass), btn('Importar', async () => {
        try { const f = document.getElementById('ksf').files[0]; if (!f) return toast('Elige el archivo.'); const j = JSON.parse(await readText(f)); const ks = await C.unsealJSON(j, pass.value); if (ks.sign.pk !== ADMIN_PK) throw new Error('Este llavero no corresponde a esta versión de la app.'); if (ks.v !== 2) throw new Error('Este llavero es de una versión anterior (v0.3). Usa el llavero v0.4.'); await DB.put('kv', 'adm', j); await DB.logEv('importar_llavero', {}); sesion(root, back, ks, pass.value); } catch (e) { toast(e.message.includes('descifrar') ? 'Frase incorrecta o archivo alterado.' : e.message); } }, 'big'))));
  }
  const pass = h('input', { type: 'password' });
  mount(root, head('Administración', 'Acceso', back), h('main', null, card(field('Frase del llavero', pass), btn('Entrar', async () => { let ks; try { ks = await C.unsealJSON(box, pass.value); } catch { await DB.logEv('acceso_fallido', { rol: 'admin' }); return toast('Frase incorrecta.'); } sesion(root, back, ks, pass.value); }, 'big'))));
}
async function sesion(root, back, ks, pass) {
  let tab = 'formas', idle; DB.setActor('Cap. Abril Mejía (Administración)', 'admin'); await DB.logEv('inicio_sesion', { rol: 'admin' });
  const persist = async () => DB.put('kv', 'adm', await C.sealJSON(ks, pass));
  const lock = () => { DB.logEv('bloqueo_inactividad', {}); ks = null; pass = null; DB.setActor('—', 'inicio'); toast('Sesión bloqueada por inactividad'); back(); };
  const bump = () => { clearTimeout(idle); idle = setTimeout(lock, 10 * 60000); }; document.addEventListener('pointerdown', bump); bump();
  const out = async () => { clearTimeout(idle); document.removeEventListener('pointerdown', bump); await DB.logEv('cierre_sesion', { rol: 'admin' }); DB.setActor('—', 'inicio'); back(); };
  const known = new Set(ks.huellas);
  const aprobadas = () => Object.entries(ks.forms).filter(([, f]) => f.estado === 'aprobada').map(([s, f]) => ({ s, ti: f.ti, clase: f.clase, ck: f.ck, ch: f.ch, n: f.n, du: f.du }));
  const aplVigentes = async () => { const t = P.now(); return ((await DB.get('kv', 'creds')) || []).filter(x => !x.rev && t <= x.core.ex && (x.core.rol || 'aplicador') === 'aplicador').map(x => x.core); };
  async function draw() {
    const tabs = [['eval', 'Evaluaciones'], ['formas', 'Formas'], ['res', 'Resultados'], ['apl', 'Personal'], ['bit', 'Bitácora'], ['adj', 'Adjuntos'], ['imp', 'Importar banco'], ['datos', 'Datos'], ['aj', 'Ajustes']]; let body; await DB.logEv('vista', { rol: 'admin', seccion: tab });
    if (tab === 'formas') {
      const ent = Object.entries(ks.forms), grupos = [...new Set(ent.map(([, f]) => f.grupo || 'Importadas'))];
      body = [card(h('h3', null, `${ent.length} formas · ${ent.filter(([, f]) => f.estado === 'aprobada').length} aprobadas para evaluar`), h('p', { class: 'mini' }, 'Solo las formas APROBADAS pueden recibir códigos de evaluación. «Borrador» = incompleta, con clave no oficial o marcada para revisión: apruébala solo si la verificaste. Esta lista solo existe en tu llavero cifrado: la app pública no contiene nombres, números ni cantidad de formas.')),
        ...grupos.map(g => card(h('h3', null, g), table(['Forma', 'Clase', 'Reactivos', 'Estado', 'Notas', ''], ent.filter(([, f]) => (f.grupo || 'Importadas') === g).map(([id, f]) => [h('b', null, f.ti), f.clase, `${f.n} (${f.nL} L)`, h('span', { class: 'pill ' + (f.estado === 'aprobada' ? 'ok' : 'warn') }, f.estado), h('small', null, (f.notas || []).join(' · ')),
          btn(f.estado === 'aprobada' ? 'Quitar aprobación' : 'Aprobar', async () => { if (f.estado !== 'aprobada' && !confirm(`¿Aprobar «${f.ti}» para evaluar?` + ((f.notas || []).length ? '\n\nObservaciones: ' + f.notas.join('; ') : ''))) return; f.estado = f.estado === 'aprobada' ? 'borrador' : 'aprobada'; await persist(); await DB.logEv('estado_forma', { id, estado: f.estado }); draw(); }, 'sm ghost')]))))];
    } else if (tab === 'apl') body = await aplTab();
    else if (tab === 'eval') body = [aprobadas().length ? emitirEval({ sign: ks.sign, box: ks.box }, aprobadas(), await aplVigentes(), null) : card(h('p', null, 'Aprueba al menos una forma.')), await emitidosUI()];
    else if (tab === 'datos') body = [datosUI()];
    else if (tab === 'res') body = [await resultadosUI({ boxSk: ks.box.sk, issuerSk: ks.sign.sk, titulo: 'Resultados (Administración: forma y calificación)', adm: { formas: ks.forms } })];
    else if (tab === 'imp') body = [await impTab()];
    else if (tab === 'bit') body = [await bitacoraAdminUI(ks.box.sk)];
    else if (tab === 'adj') { const { adjuntosUI } = await import('./adjuntos.js'); body = [await adjuntosUI(ks, persist)]; }
    else body = await ajTab();
    mount(root, head('Administración', 'Cap. Abril Mejía · control total', out), h('nav', { class: 'tabs' }, tabs.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l))), h('main', { class: 'wide' }, body));
  }
  async function aplTab() {
    const issued = (await DB.get('kv', 'creds')) || [], now = P.now(), req = h('textarea', { class: 'tok', rows: 3, placeholder: 'Pega la solicitud del docente (SOL1.…)' }), out = h('div');
    const nb = h('input', { type: 'datetime-local', value: toLocalInput(now) }), ex = h('input', { type: 'datetime-local', value: toLocalInput(now + 8 * 3600) });
    const rol = h('select', null, Object.entries(P.ROLES).map(([k, v]) => h('option', { value: k }, v)));
    return [card(h('h3', null, 'Registrar personal'), h('p', { class: 'mini' }, 'v0.4: solo tú (Administración) tienes control total. Aplicador: recibe los resultados de las evaluaciones en que lo designes y entrega acuses; no emite exámenes ni ve formas o claves. Directora: solo consulta de todas las secciones mediante el paquete de consulta; no modifica ni genera códigos, y nunca recibe formas, PIN ni códigos de evaluación. Piloto: prueba del dispositivo con reactivos neutros; no usa formas. Cada código queda ligado al dispositivo de la persona. Máximo 31 días.'), field('Perfil', rol), field('Solicitud', req),
      h('div', { class: 'g2' }, field('Vigente desde', nb), field('Hasta', ex)),
      btn('Emitir código', async () => { try {
        const r = P.readRequest(req.value), nbv = fromLocalInput(nb.value), exv = fromLocalInput(ex.value); if (exv - nbv > 31 * 86400) throw new Error('Vigencia máxima: 31 días.');
        const c = P.issueCred(ks, r, { nb: nbv, ex: exv, rol: rol.value }); issued.unshift({ core: c.core, ts: Date.now() }); await DB.put('kv', 'creds', issued); await DB.logEv('emitir_' + rol.value, { id: c.core.id, nm: r.nm, rol: rol.value, nb: nbv, ex: exv });
        out.replaceChildren(card(h('p', null, 'Huella del dispositivo: ', h('b', { class: 'mono' }, await C.fingerprint(r.pk)), ' (confírmala con el docente)'), tokenBox(c.token, `Código de ${P.ROLES[rol.value]} para ${r.nm}:`, 'codigo_' + rol.value + '.txt'))); } catch (e) { toast(e.message); } }, 'big'), out),
    card(h('h3', null, 'Códigos de personal emitidos'), issued.length ? table(['Nombre', 'Perfil', 'Vigencia', 'Estado', '', ''], issued.map(x => [x.core.nm, P.ROLES[x.core.rol || 'aplicador'], `${fmtDT(x.core.nb)} → ${fmtDT(x.core.ex)}`, h('span', { class: 'pill ' + (x.rev ? 'bad' : now > x.core.ex ? 'bad' : 'ok') }, x.rev ? 'revocado' : now > x.core.ex ? 'vencido' : 'vigente'),
      x.rev ? '' : btn('Revocar', async () => { if (!confirm('Se generará un boletín de revocación que debes distribuir a los equipos de los cadetes. ¿Revocar?')) return; x.rev = true; await DB.put('kv', 'creds', issued); const ids = issued.filter(y => y.rev).map(y => y.core.id); const b = P.mkRevocation(ks.sign.sk, ids); await DB.logEv('revocar_personal', { id: x.core.id, rol: x.core.rol || 'aplicador' }); const o = h('div'); o.append(card(tokenBox(b, 'Boletín de revocación (los cadetes lo importan en Inicio → Boletín de revocación). Limitación: sin internet, solo surte efecto en los equipos que lo importen.', 'boletin_revocacion.txt'))); out.replaceChildren(o); }, 'sm ghost'),
      (x.core.rol === 'directora' && !x.rev && now <= x.core.ex) ? btn('Paquete de consulta', async () => { const d = await datosConsulta(ks); const t = P.mkConsulta(ks, x.core, d); await DB.logEv('emitir_consulta', { para: x.core.id, nm: x.core.nm, resultados: d.resultados.length, emitidos: d.emitidos.length }); out.replaceChildren(card(h('p', { class: 'mini' }, 'Paquete de SOLO CONSULTA (cifrado para el dispositivo de la Directora). No contiene formas, PIN, códigos de evaluación ni claves.'), tokenBox(t, `Paquete de consulta para ${x.core.nm}:`, 'consulta_direccion.txt'))); }, 'sm') : ''])) : h('p', { class: 'mini' }, 'Sin códigos emitidos.'))];
  }
  async function impTab() {
    const ctx = { known, save: d => DB.put('borradores', d.id, d), discard: async d => { await DB.del('borradores', d.id); tab = 'imp'; draw(); },
      approve: async d => { await aprobar(d); } };
    const drafts = (await DB.all('borradores')).map(x => x[1]); const { draftEditor } = await import('./pdfimport.js');
    return h('div', null, await newDraftUI(ctx), ...drafts.map(d => card(h('h3', null, 'Borrador guardado: ' + d.titulo), draftEditor(d, ctx))));
  }
  async function aprobar(d) { // v0.4: la forma importada se guarda como bloques opacos (+ señuelos) y un archivo .evd de nombre neutro
    const items = d.items.filter(x => !x.err.length).sort((a, b) => a.n - b.n), audios = {}, slot = 'S' + C.hex(C.rnd(8)), ck = C.rnd(32);
    const meta = { v: 2, n: items.length, items: items.map((x, i) => { let au = null; if (x.sec === 'L') { au = 'a' + (i + 1); audios[au] = d.audio[x.au]; } return { n: i + 1, sec: x.sec, tp: 'Importado', pas: x.pas || undefined, q: x.q, o: x.o, au }; }) };
    const chunks = await C.sealForm(ck, meta, audios), names = chunks.map(() => C.chunkName()), ent = chunks.map((c, i) => [names[i], c]);
    while (ent.length < 8 || ent.length % 4) ent.push([C.chunkName(), C.decoyChunk()]);
    for (let i = ent.length - 1; i > 0; i--) { const j = C.rnd(1)[0] % (i + 1); [ent[i], ent[j]] = [ent[j], ent[i]]; }
    for (const [n, c] of ent) await DB.put('d', n, c);
    const clase = /ALCPT/i.test(d.tipo || '') ? 'ALCPT' : 'ALC';
    ks.forms[slot] = { s: slot, codigo: d.id, ck: C.b64(ck), ch: names, k: items.map(x => x.k), ti: d.titulo, grupo: 'Importadas (oficiales)', clase, tipo: d.tipo, n: items.length, nL: items.filter(x => x.sec === 'L').length, du: d.du, estado: 'aprobada', notas: d.items.length - items.length ? [`${d.items.length - items.length} reactivos excluidos por errores`] : [], origen: 'importada' };
    for (const x of items) ks.huellas.push(x.hh); await persist(); await DB.del('borradores', d.id); await DB.logEv('aprobar_importacion', { s: slot, n: items.length, excluidos: d.items.length - items.length });
    download('datos_evaluacion_' + C.hex(C.rnd(3)) + '.evd', C.packEVD(ent)); toast('Forma aprobada. Se descargó un archivo de datos (.evd) de nombre neutro: impórtalo en los dispositivos (Inicio → Datos). Descarga también el respaldo del llavero.'); tab = 'formas'; draw();
  }
  async function ajTab() {
    const logs = (await DB.all('log')).map(x => x[1]).slice(-60).reverse();
    return [card(h('h3', null, 'Respaldo del llavero'), h('p', { class: 'mini' }, 'Descarga el llavero actualizado (con formas importadas y aprobaciones). Guárdalo fuera de este dispositivo.'), btn('Descargar llavero cifrado', async () => { await DB.logEv('exportar_llavero', {}); download('admin_keystore.enc.json', JSON.stringify(await C.sealJSON(ks, pass)), 'application/json'); })),
      card(h('h3', null, 'Cambiar frase'), (() => { const a = h('input', { type: 'password', placeholder: 'Nueva frase (12+ caracteres)' }); return h('div', null, a, btn('Cambiar', async () => { if (a.value.length < 12) return toast('Mínimo 12 caracteres.'); pass = a.value; await persist(); await DB.logEv('cambiar_frase', {}); toast('Frase cambiada. Descarga un respaldo nuevo.'); })); })()),
      card(h('h3', null, 'Bitácora'), h('p', { class: 'mini' }, `La bitácora completa de todos los perfiles está en la pestaña «Bitácora» (${logs.length ? 'último evento: ' + new Date(logs[0].ts).toLocaleString('es-MX') : 'sin eventos'}).`))];
  }
  draw();
}
