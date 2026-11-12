// Integridad del examen (compartido por ambas versiones).
// Detecta, con las limitaciones propias de una página web:
//  · cambio de ventana / app, deslizar a otra pantalla, bloquear el equipo (visibilitychange, blur, pagehide)
//  · tecla Impr Pant y algunos atajos de captura cuando el navegador los entrega (muchos sistemas NO los entregan)
//  · traducción automática de la página (clases translated-ltr/rtl, cambio de lang, nodos <font> insertados, atributos _msttexthash)
//  · intento de imprimir (beforeprint)
// Eventos casi simultáneos (p. ej. blur + visibilitychange del mismo cambio de app) se cuentan como UN incidente.
//  · v0.3: pantalla completa obligatoria y «otras apps visibles» (Split View, Slide Over, Stage Manager, pantalla dividida,
//    ventana flotante o reducida): se comparan las dimensiones de la ventana con las de la pantalla y se sondea
//    document.hasFocus() / document.hidden / fullscreenElement cada 500 ms y en cada resize, fullscreenchange, blur, focus.
//    Un mismo episodio (desde que deja de estar bien hasta que vuelve a estar bien) cuenta UNA sola vez.
export const TIPOS = { ventana: 'Cambio de ventana o app / pantalla oculta', foco: 'La app perdió el foco (otra app o ventana activa)', salida: 'Salida o recarga de la página', captura: 'Tecla o atajo de captura de pantalla', traduccion: 'Traducción automática de la página', impresion: 'Intento de imprimir', pantalla: 'Sin pantalla completa / otras apps visibles (pantalla dividida, Slide Over, ventana flotante o reducida)' };
export const TIPOS_EN = { ventana: 'Switched to another app or window / screen hidden', foco: 'The exam lost focus (another app or window was active)', salida: 'Left or reloaded the exam page', captura: 'Screenshot key or shortcut', traduccion: 'Automatic page translation', impresion: 'Print attempt', pantalla: 'Exam not in full screen / other apps visible (split screen, Slide Over, floating or resized window)' };
export const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export const fsSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
export const standalone = () => { try { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches; } catch { return false; } };
export async function pedirPantallaCompleta() { // debe llamarse desde un toque/clic del cadete
  const el = document.documentElement; if (fsElement()) return true;
  try { if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch { }
  await new Promise(r => setTimeout(r, 250)); return !!fsElement();
}
// ¿La ventana del examen ocupa toda la pantalla y tiene el foco? Tolerancias: ancho ≥ 92 % de la pantalla; alto ≥ 85 % en pantalla
// completa y ≥ 80 % instalada (barras del sistema: estado, navegación, muesca). Se usa el mayor de inner/outer para no confundir el zoom.
export function estadoPantalla() {
  if (document.hidden) return { ok: false, motivo: 'ventana' };
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return { ok: false, motivo: 'foco' };
  const fs = !!fsElement(), sa = standalone(); if (!fs && !sa) return { ok: false, motivo: 'pantalla', sinFs: true };
  // Se prueba la ventana contra la pantalla en vertical Y en horizontal y basta con que encaje en una: así un reporte de orientación
  // atrasado (al girar) no da falsos positivos, y una ventana a media pantalla nunca encaja en ninguna de las dos.
  const L = Math.max(screen.width, screen.height), S = Math.min(screen.width, screen.height), w = Math.max(innerWidth, outerWidth || 0), hh = Math.max(innerHeight, outerHeight || 0), fh = fs ? 0.85 : 0.8;
  const cabe = (W, H) => w >= W * 0.92 && hh >= H * fh;
  if (!cabe(S, L) && !cabe(L, S)) return { ok: false, motivo: 'pantalla', dim: `${w}x${hh} de ${screen.width}x${screen.height}` };
  return { ok: true };
}
// onIncident(tipo, t); onEstado(estado, armado) para bloquear/desbloquear la vista. «armado»: ya estuvo bien al menos una vez
// (antes de eso el examen no inicia y no se cuentan incidentes de pantalla, p. ej. al reanudar tras una recarga).
export function vigilar(onIncident, { ventanaMs = 2500, onEstado = null, pollMs = 500, graciaMs = 600 } = {}) {
  let last = 0, on = true, armed = false, bad = null, pend = 0; const html = document.documentElement, lang0 = html.getAttribute('lang') || 'es';
  const fire = tipo => { if (!on) return; const t = Date.now(); if (t - last < ventanaMs) return; last = t; onIncident(tipo, t); };
  const check = () => {
    if (!on) return; const s = estadoPantalla(); try { onEstado && onEstado(s, armed); } catch { }
    if (s.ok) { armed = true; bad = null; pend = 0; return; }
    if (!armed || bad) return;
    if (s.motivo === 'pantalla') { if (!pend) { pend = Date.now(); setTimeout(check, graciaMs + 20); return; } if (Date.now() - pend < graciaMs) return; } // gracia para rotación de pantalla
    bad = s.motivo; fire(s.motivo);
  };
  const onBlur = () => { if (armed && !bad) { bad = 'foco'; fire('foco'); } check(); };
  const onHide = () => fire('salida');
  const onKey = e => { const k = e.key || '', c = e.code || ''; if (k === 'PrintScreen' || c === 'PrintScreen' || (e.metaKey && e.shiftKey && /^(Digit[345]|KeyS)$/.test(c)) || (e.ctrlKey && e.shiftKey && c === 'KeyS' && e.metaKey)) { fire('captura'); } };
  const onPrint = () => fire('impresion');
  const traducida = () => /\btranslated-(ltr|rtl)\b/.test(html.className) || (html.getAttribute('lang') || lang0) !== lang0 || !!document.querySelector('font, [_msttexthash], [_msthash]');
  let trad = false; // cuenta UNA vez por cada vez que se activa la traducción (no por cada cambio mientras siga traducida)
  const mo = new MutationObserver(() => { const t = traducida(); if (t && !trad) { trad = true; fire('traduccion'); } else if (!t) trad = false; });
  mo.observe(html, { attributes: true, attributeFilter: ['class', 'lang'], childList: true, subtree: true });
  const EV = [[document, 'visibilitychange', check], [document, 'fullscreenchange', check], [document, 'webkitfullscreenchange', check], [window, 'resize', check], [window, 'focus', check], [window, 'orientationchange', check], [window, 'blur', onBlur], [window, 'pagehide', onHide], [window, 'beforeprint', onPrint]];
  if (window.visualViewport) EV.push([window.visualViewport, 'resize', check]);
  for (const [o, e, f] of EV) o.addEventListener(e, f); window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);
  const iv = setInterval(check, pollMs); setTimeout(check, 0);
  if (traducida()) { trad = true; setTimeout(() => fire('traduccion'), 0); }
  return () => { on = false; clearInterval(iv); mo.disconnect(); for (const [o, e, f] of EV) o.removeEventListener(e, f); window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); };
}
// Imagen del estado del examen en el momento del incidente. Se DIBUJA con los datos del examen en un <canvas>
// (no es una captura del sistema operativo: una página web no puede ver otras apps ni la pantalla real).
export function evidencia(s) {
  // s: {ti, mat, nom, tipo, n, max, t, pos, total, bloque, q, opts:[texto], sel (índice mostrado o -1), audio, restante}
  const W = 720, pad = 22, cv = document.createElement('canvas'), x = cv.getContext('2d'); cv.width = W; cv.height = 900;
  const F = (sz, b) => `${b ? '700 ' : ''}${sz}px "Noto Sans", sans-serif`;
  const wrap = (txt, sz, b, maxW) => { x.font = F(sz, b); const out = []; for (const par of String(txt || '').split('\n')) { let line = ''; for (const w of par.split(/\s+/)) { const tryL = line ? line + ' ' + w : w; if (x.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; } out.push(line); } return out; };
  const ops = []; let y = 0; const add = (fn, hgt) => { ops.push([fn, y]); y += hgt; };
  add((yy) => { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#6366f1'); g.addColorStop(1, '#ec4899'); x.fillStyle = g; x.fillRect(0, yy, W, 84); x.fillStyle = '#fff'; x.font = F(20, 1); x.fillText(String(s.ti || '').slice(0, 60), pad, yy + 34); x.font = F(14); x.fillText(`${s.bloque || ''} · Reactivo ${s.pos} de ${s.total} · tiempo restante ${s.restante || ''}`, pad, yy + 62); }, 96);
  add((yy) => { x.fillStyle = '#fee2e2'; x.fillRect(pad, yy, W - 2 * pad, 74); x.fillStyle = '#991b1b'; x.font = F(16, 1); x.fillText(`INCIDENTE ${s.n} de ${s.max}: ${s.tipo}`, pad + 12, yy + 28); x.font = F(13); x.fillText(`${new Date(s.t).toLocaleString('es-MX')} · ${s.mat} · ${String(s.nom || '').slice(0, 50)}`, pad + 12, yy + 54); }, 88);
  if (s.audio) add((yy) => { x.fillStyle = '#4338ca'; x.font = F(14, 1); x.fillText(`🔊 Audio: le quedan ${s.audio} reproducciones`, pad, yy + 18); }, 30);
  const ql = wrap(s.q || '(sin enunciado escrito)', 17, 1, W - 2 * pad); add((yy) => { x.fillStyle = '#1f2340'; x.font = F(17, 1); ql.forEach((l, k) => x.fillText(l, pad, yy + 20 + k * 24)); }, ql.length * 24 + 16);
  (s.opts || []).forEach((t, k) => { const ol = wrap(t, 15, 0, W - 2 * pad - 60); const hh = Math.max(44, ol.length * 21 + 22); add((yy) => { const sel = k === s.sel; x.fillStyle = sel ? '#e0e7ff' : '#f8f9ff'; x.strokeStyle = sel ? '#4f46e5' : '#d5d8ee'; x.lineWidth = 2; x.fillRect(pad, yy, W - 2 * pad, hh - 8); x.strokeRect(pad, yy, W - 2 * pad, hh - 8); x.fillStyle = '#1f2340'; x.font = F(15, 1); x.fillText('ABCD'[k], pad + 14, yy + 27); x.font = F(15); ol.forEach((l, j) => x.fillText(l, pad + 48, yy + 27 + j * 21)); if (sel) { x.fillStyle = '#4f46e5'; x.font = F(12, 1); x.fillText('marcada', W - pad - 70, yy + 18); } }, hh); });
  add((yy) => { x.fillStyle = '#6b7280'; x.font = F(11); x.fillText('Imagen generada por la app con el estado del examen (no es una captura del sistema operativo).', pad, yy + 22); }, 36);
  const H = Math.min(1600, y + 10), out = document.createElement('canvas'); out.width = W; out.height = H; x.canvas.height = H; // re-dibujar con alto final
  const x2 = out.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, W, H);
  const real = x; real.fillStyle = '#fff'; real.fillRect(0, 0, W, H); for (const [fn, yy] of ops) fn(yy);
  x2.drawImage(cv, 0, 0); return out.toDataURL('image/jpeg', 0.6);
}
