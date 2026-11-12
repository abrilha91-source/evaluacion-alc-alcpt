// Mensajes de error para el CADETE en inglés (v0.3). Los módulos de protocolo y el servidor generan mensajes en español
// (los ve también el personal); aquí se traducen. Si llega un mensaje desconocido NO se muestra en español: se da uno genérico.
const D = [
  [/PIN incorrecto/i, 'Wrong PIN.'],
  [/Firma inválida/i, 'Invalid signature: the code is fake or was altered.'],
  [/Código dañado|Formato de código|Código inválido/i, 'Invalid or incomplete code.'],
  [/todavía no está vigente|aún no está vigente/i, 'This code is not valid yet.'],
  [/venció/i, 'This code has expired.'],
  [/reloj del dispositivo/i, "The device clock seems to have gone back. Fix the date and time."],
  [/versión anterior/i, 'This code is from an earlier version of the app and is no longer valid. Ask your proctor for a new code.'],
  [/Este código fue revocado/i, 'This exam code was revoked.'],
  [/Datos de evaluación|Archivo de datos inválido/i, 'The exam data on this device is incomplete, invalid or was altered. Ask your proctor.'],
  [/revocad/i, 'The proctor code that issued this exam was revoked.'],
  [/no estaba autorizado|Emisor|emisor no coincide|excede/i, 'This exam code was not issued by an authorized proctor.'],
  [/paquete de esta forma en tu dispositivo no corresponde/i, 'The question pack on this device does not match this exam (different version). Ask your proctor for the correct pack.'],
  [/No es un paquete de forma válido|Archivo inválido/i, 'Not a valid question pack file.'],
  [/Archivo ignorado/i, 'File ignored (it is not an exam pack).'],
  [/No se pudo descifrar|No se pudo abrir \(no es para/i, 'Could not unlock (wrong code or PIN, or the file was altered).'],
  [/cámara/i, 'Could not open the camera (permission denied or no camera). Paste the code as text.'],
  [/QR no disponible/i, 'QR not available.'],
  [/acuse no corresponde/i, 'This receipt does not belong to your result.'],
  [/Formato de resultado|Formato de acuse|acuse/i, 'Invalid receipt.'],
  [/aviso de privacidad/i, 'You must accept the privacy notice.'],
  [/Matrícula inválida/i, 'Invalid cadet ID.'],
  [/Nombre inválido/i, 'Invalid name.'],
  [/fue cerrada/i, 'This exam was closed by the proctor.'],
  [/ya no está aprobada/i, 'This exam form is no longer approved.'],
  [/Ya entregaste/i, 'You already submitted this exam.'],
  [/intento en curso con esta matrícula en otro dispositivo/i, 'There is already an exam in progress with this cadet ID on another device. Ask your proctor to reset it.'],
  [/tiempo .*termin|El tiempo terminó/i, 'Time is over for this exam.'],
  [/Intento cerrado/i, 'This exam attempt is closed.'],
  [/Intento no autorizado/i, 'Session not authorized. Start again with your code.'],
  [/Demasiados|Demasiadas/i, 'Too many attempts. Wait 15 minutes.'],
  [/Audio no encontrado/i, 'Audio not found.'],
  [/aún no tiene registrados los 3 incidentes/i, 'The server is still receiving your incidents; retrying.'],
  [/Sin conexión|Failed to fetch|NetworkError|Load failed/i, 'No connection to the server.'],
  [/Respuesta inesperada/i, 'Unexpected server response.'],
  [/Respuestas inválidas|JSON inválido|seq inválido|Incidente inválido|Idempotency/i, 'The server rejected the data. Tell your proctor.'],
  [/^Error \d+$/, m => m],
];
export function enErr(e) {
  const m = String((e && e.message) || e || '').trim();
  for (const [re, t] of D) if (re.test(m)) return typeof t === 'function' ? t(m) : t;
  if (m && /^[\x20-\x7E]+$/.test(m) && !/\b(el|la|los|las|del|de|que|no|un|una|para|con|por)\b/i.test(m)) return m; // ya está en inglés
  return 'Something went wrong. Show this screen to your proctor.';
}
// Título de la forma para el cadete (los títulos del banco están en español).
const TT = [[/Idioma Extranjero/g, 'Foreign Language'], [/Parcial (\d)/g, 'Partial Exam $1'], [/versión/g, 'version'], [/\bForma\b/g, 'Form'], [/\bforma\b/g, 'form'], [/completa/g, 'complete'], [/Lectura/g, 'Reading'], [/Comprensión auditiva/g, 'Listening']];
export const tituloEN = ti => TT.reduce((s, [re, r]) => s.replace(re, r), String(ti || ''));
// Tipo de reactivo (etiqueta) en inglés; si no se conoce y no está en inglés, no se muestra.
const TP = { 'Aviso': 'Notice', 'Comprensión auditiva': 'Listening comprehension', 'Diálogo': 'Dialogue', 'Enunciado': 'Statement', 'Escucha: comprensión': 'Listening: comprehension', 'Escucha: datos': 'Listening: details', 'Escucha: respuesta': 'Listening: response', 'Gramática': 'Grammar', 'Lectura': 'Reading', 'Noticia': 'News', 'Original': 'Original', 'Pregunta': 'Question', 'Vocabulario': 'Vocabulary', 'Vocabulario (definición)': 'Vocabulary (definition)', 'Vocabulario (escucha)': 'Vocabulary (listening)' };
export const tipoEN = tp => !tp ? '' : TP[tp] || (/^[\x20-\x7E]+$/.test(tp) && !/\b(de|la|el|y|con)\b/i.test(tp) ? tp : '');
