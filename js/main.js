import { h, mount, $, card, btn, toast, T } from './util.js'; import * as DB from './db.js'; import * as P from './protocol.js'; import { purgarV03 } from './db.js'; import { VERSION } from './config.js'; import { CAMPOS, FINALIDAD, DESTINO_OFFLINE, NO_SE_RECOGE } from './aviso.js';
const root = $('#app'); let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register(window.trustedTypes ? window.trustedTypes.createPolicy('eo-sw', { createScriptURL: x => { if (x !== 'sw.js') throw new Error('URL no permitida'); return x; } }).createScriptURL('sw.js') : 'sw.js').catch(() => { });
const net = h('div', { class: 'net' }); document.body.append(net);
const upd = () => { net.textContent = navigator.onLine ? T('● con conexión', '● online') : T('○ sin internet (la app funciona igual)', '○ offline (the app still works)'); }; addEventListener('online', upd); addEventListener('offline', upd); addEventListener('eo-lang', upd); upd();
export function home() {
  mount(root, h('div', { class: 'modebar' }, 'Versión SIN INTERNET · v' + VERSION),
    h('div', { class: 'login' }, h('div', { class: 'brand' }, h('img', { src: 'icon-192.png', alt: '' }), h('div', null, h('h1', null, 'Evaluación Oficial'), h('p', null, 'Esc. Mil. Enfría. · Mesa de Inglés · solo evaluaciones ALC / ALCPT'))),
      h('button', { class: 'role', onclick: async () => (await import('./v-cadete.js')).cadete(root, home) }, h('i', null, '🎓'), h('div', null, h('b', null, 'Soy cadete · I am a cadet'), h('span', null, 'Take an exam with my code and PIN'))),
      h('button', { class: 'role', onclick: async () => (await import('./v-apl.js')).aplicador(root, home) }, h('i', null, '🧑‍🏫'), h('div', null, h('b', null, 'Docente aplicador'), h('span', null, 'Recibir resultados y entregar acuses'))),
      h('button', { class: 'role', onclick: async () => (await import('./v-apl.js')).directora(root, home) }, h('i', null, '🏛️'), h('div', null, h('b', null, 'Directora (solo consulta)'), h('span', null, 'Consultar evaluaciones, resultados y personal'))),
      h('button', { class: 'role', onclick: async () => (await import('./v-apl.js')).piloto(root, home) }, h('i', null, '🧪'), h('div', null, h('b', null, 'Usuario piloto'), h('span', null, 'Prueba del dispositivo (no es evaluación)'))),
      h('button', { class: 'role', onclick: async () => (await import('./v-adm.js')).admin(root, home) }, h('i', null, '🛡️'), h('div', null, h('b', null, 'Administración'), h('span', null, 'Emitir códigos de evaluación · formas · resultados'))),
      card(h('h3', null, 'Este dispositivo'), h('div', { class: 'row' }, btn('Instalar app', async () => { if (deferred) { deferred.prompt(); deferred = null; } else toast('Usa el menú del navegador → «Instalar app» / «Agregar a pantalla de inicio».'); }, 'sm ghost'),
        btn('Preparar para uso sin internet', async () => { const { prepararSinInternet } = await import('./common.js'); toast('Descargando datos cifrados…'); const r = await prepararSinInternet(); toast(r.n ? `${r.ok} de ${r.n} bloques de datos guardados` : 'Necesitas conexión para descargar los datos.'); }, 'sm ghost'),
        btn('Importar datos (.evd)', async () => { const { importarDatos } = await import('./common.js'); const i = h('input', { type: 'file', accept: '.evd', multiple: true }); i.onchange = async () => toast((await importarDatos(i.files)) + ' bloques nuevos'); i.click(); }, 'sm ghost'),
        btn('Boletín de revocación', () => revo(), 'sm ghost'), btn('Aviso de privacidad', async () => { const { avisoCard } = await import('./v-cadete.js'); mount(root, h('header', null, h('div', null, h('b', null, 'Aviso de privacidad')), h('button', { class: 'ico', onclick: home }, '⌂')), h('main', null, avisoCard())); }, 'sm ghost')),
        h('p', { class: 'mini' }, 'Solo evaluaciones oficiales (ALC parciales; ALCPT diagnóstico, final y de seguimiento). Un examen solo inicia con el código y el PIN que emite la Administración. Los datos viajan cifrados en bloques iguales: no revelan qué forma se aplicará.'))));
}
function revo() {
  const ta = h('textarea', { class: 'tok', rows: 3, placeholder: 'RV1.…' });
  mount(root, h('header', null, h('div', null, h('b', null, 'Boletín de revocación')), h('button', { class: 'ico', onclick: home }, '⌂')), h('main', null, card(h('p', { class: 'mini' }, 'El Administrador puede revocar códigos de aplicador. Sin internet, la revocación solo vale en los equipos donde se importe este boletín.'), ta, btn('Importar', async () => { try { const b = P.readRevocation(ta.value); const cur = new Set((await DB.get('kv', 'revoked')) || []); b.ids.forEach(i => cur.add(i)); await DB.put('kv', 'revoked', [...cur]); toast(`${b.ids.length} códigos revocados`); home(); } catch (e) { toast(e.message); } }))));
}
purgarV03(); home();
