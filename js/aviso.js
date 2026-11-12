// Fuente ÚNICA del aviso de privacidad: la pantalla se genera desde esta lista y el resultado se construye con los mismos campos.
export const CAMPOS = [
  ['Matrícula, nombre, año y grupo', 'Los escribes tú al iniciar. Se guardan en este dispositivo y viajan únicamente dentro de tu resultado cifrado.'],
  ['Tus respuestas (A–D) y la hora de inicio y fin', 'Se guardan mientras contestas, para que no se pierdan si se cierra la app.'],
  ['Incidentes durante el examen (cambio de app o ventana, salir de pantalla completa, otras apps visibles, captura, traducción)', 'Se registran el tipo, la hora, el reactivo y una imagen que la app dibuja con el estado de tu examen. No se ve ni se guarda lo que hay fuera de la app.'],
  ['Un identificador aleatorio de este dispositivo y del resultado', 'Sirve para evitar duplicados; no contiene datos del aparato ni ubicación.']
];
export const NO_SE_RECOGE = 'No se recoge: ubicación, contactos, fotos, micrófono ni cámara (la cámara solo se usa si tú eliges escanear un QR, y no se guarda nada).';
export const DESTINO_OFFLINE = 'Esta versión funciona sin internet: no envía nada a ningún servidor. Tu resultado va cifrado, solo para el aplicador que emitió el examen y para el Administrador (Cap. Abril Mejía), a quienes se lo entregas tú (QR, texto o archivo).';
export const DESTINO_ONLINE = 'Esta versión envía tus respuestas por internet al servidor de la escuela, por conexión cifrada (HTTPS). Solo pueden verlas el Administrador y el aplicador que emitió el examen.';
export const FINALIDAD = 'Finalidad: evaluar de manera formal y oficial tu desempeño en inglés (ALC/ALCPT) en la Esc. Mil. Enfría. No se usa para otro fin.';
// Versión en inglés para el flujo del cadete (v0.3: desde que el cadete entra, todo va en inglés). Mismo contenido.
export const CAMPOS_EN = [
  ['Cadet ID, name, year and group', 'You type them when you start. They are stored on this device and travel only inside your encrypted result.'],
  ['Your answers (A–D) and the start and end time', 'They are saved while you answer so they are not lost if the app closes.'],
  ['Incidents during the exam (switching apps or windows, leaving full screen, other apps visible, screenshots, translation)', 'The type, time, question and an image that the app draws of your exam are recorded. Nothing outside the app is seen or stored.'],
  ['A random identifier of this device and of the result', 'It prevents duplicates; it contains no device data or location.']
];
export const NO_SE_RECOGE_EN = 'Not collected: location, contacts, photos, microphone or camera (the camera is only used if you choose to scan a QR code, and nothing is stored).';
export const DESTINO_OFFLINE_EN = 'This version works without internet: it sends nothing to any server. Your result is encrypted, only for the proctor who issued the exam and for the Administrator (Capt. Abril Mejía); you hand it over yourself (QR, text or file).';
export const DESTINO_ONLINE_EN = "This version sends your answers over the internet to the school's server through an encrypted connection (HTTPS). Only the Administrator and the proctor who issued the exam can see them.";
export const FINALIDAD_EN = 'Purpose: to formally and officially assess your English performance (ALC/ALCPT) at the Military Nursing School. It is not used for any other purpose.';
