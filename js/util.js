// Utilidades de interfaz. REGLA DE SEGURIDAD: no se usa innerHTML/outerHTML/insertAdjacentHTML/document.write en ninguna parte.
// Todo texto externo (nombres, reactivos importados, resultados) entra como textContent.
export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e[k] = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'multiple') e[k] = v;
    else if (k === 'href') { if (!/^(blob:|#|[./\w-])/.test(String(v)) || /^\s*javascript:/i.test(String(v))) continue; e.setAttribute(k, v); }
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const mount = (root, ...kids) => { root.replaceChildren(...kids.flat(Infinity).filter(Boolean)); window.scrollTo(0, 0); };
let tt; export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200); }
// Idioma: el flujo del CADETE va en inglés (v0.3); administración y aplicador siguen en español.
export const isEN = () => document.documentElement.lang === 'en';
export const T = (es, en) => isEN() ? en : es;
export function setLang(l) { if (document.documentElement.lang !== l) { document.documentElement.lang = l; dispatchEvent(new Event('eo-lang')); } }
export const fmtDT = s => new Date(s * 1000).toLocaleString(isEN() ? 'en-US' : 'es-MX', { dateStyle: 'medium', timeStyle: 'short' });
export const toLocalInput = s => { const d = new Date(s * 1000), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const fromLocalInput = v => Math.floor(new Date(v).getTime() / 1000);
export function download(name, data, type = 'application/octet-stream') {
  const u = URL.createObjectURL(new Blob([data], { type })); const a = h('a', { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
export async function copy(text) { try { await navigator.clipboard.writeText(text); toast(T('Copiado', 'Copied')); } catch { toast(T('No se pudo copiar; selecciona el texto y cópialo.', 'Could not copy; select the text and copy it.')); } }
export const readFile = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(new Uint8Array(r.result)); r.onerror = () => no(r.error); r.readAsArrayBuffer(f); });
export const readText = async f => new TextDecoder().decode(await readFile(f));
export const pad = n => String(n).padStart(2, '0');
export const mmss = s => `${pad(Math.floor(Math.max(0, s) / 60))}:${pad(Math.max(0, s) % 60)}`;
export const slug = s => String(s).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60);
export function card(...k) { return h('section', { class: 'card' }, ...k); }
export function btn(label, fn, cls = '') { return h('button', { class: 'btn ' + cls, onclick: fn }, label); }
export function field(label, input, hint) { return h('label', null, label, input, hint ? h('span', { class: 'mini' }, hint) : null); }
export function table(head, rows) { return h('div', { class: 'tw' }, h('table', null, h('tr', null, head.map(x => h('th', null, x))), rows.map(r => h('tr', null, r.map(c => h('td', null, c)))))); }
