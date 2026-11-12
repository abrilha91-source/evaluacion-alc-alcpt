import { h, T } from './util.js';
export function qrCanvas(text, px = 4) {
  if (!globalThis.qrcode) throw new Error('QR no disponible');
  const q = globalThis.qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
  const n = q.getModuleCount(), m = 4, c = document.createElement('canvas'); c.width = c.height = (n + m * 2) * px;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + m) * px, (y + m) * px, px, px);
  c.className = 'qrc'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', T('Código QR', 'QR code')); return c;
}
export function qrBox(text, label) {
  if (text.length > 2400) return h('p', { class: 'mini' }, T('Este código es demasiado largo para un QR: compártelo como texto o archivo.', 'This code is too long for a QR code: share it as text or a file.'));
  try { return h('div', { class: 'center' }, qrCanvas(text, text.length > 900 ? 3 : 5), label ? h('p', { class: 'mini' }, label) : null); } catch (e) { return h('p', { class: 'mini' }, T('No se pudo dibujar el QR.', 'Could not draw the QR code.')); }
}
// Escáner: BarcodeDetector si existe; si no, jsQR sobre fotogramas del video.
export async function escanear(onText) {
  const video = h('video', { playsinline: '', autoplay: '', muted: '', class: 'scanv' }); video.muted = true;
  const box = h('div', { class: 'scanbox' }, video, h('button', { class: 'btn ghost', onclick: stop }, T('Cerrar cámara', 'Close camera')));
  document.body.append(box); let on = true, stream;
  function stop() { on = false; if (stream) stream.getTracks().forEach(t => t.stop()); box.remove(); }
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { stop(); throw new Error('No se pudo abrir la cámara (permiso denegado o sin cámara). Pega el código como texto.'); }
  video.srcObject = stream; await video.play();
  const det = 'BarcodeDetector' in globalThis ? new BarcodeDetector({ formats: ['qr_code'] }) : null, cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const tick = async () => {
    if (!on) return;
    if (video.readyState >= 2) {
      try {
        let txt = null;
        if (det) { const r = await det.detect(video); if (r.length) txt = r[0].rawValue; }
        else if (globalThis.jsQR) { cv.width = video.videoWidth; cv.height = video.videoHeight; cx.drawImage(video, 0, 0); const d = cx.getImageData(0, 0, cv.width, cv.height), r = globalThis.jsQR(d.data, d.width, d.height); if (r) txt = r.data; }
        if (txt) { stop(); onText(txt); return; }
      } catch { }
    }
    setTimeout(tick, 150);
  }; tick();
}
