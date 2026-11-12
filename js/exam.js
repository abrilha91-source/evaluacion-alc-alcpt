// Reproductor de examen compartido por las versiones SIN internet y CON internet. TODO lo que ve el cadete está en INGLÉS (v0.3).
// · Orden por intento: o.plan = {A:[índices con audio], T:[índices sin audio], op:{índice:[permutación de opciones]}} (ver order.js).
//   Las respuestas se guardan en el orden ORIGINAL del banco (o.answers[índice] = opción original), así la clave no cambia.
// · Dos bloques (con audio / sin audio): el cadete elige con cuál empezar (o.bloque persistente) y luego pasa al otro.
// · Audio: máximo o.maxPlays reproducciones por reactivo; el contador se guarda ANTES de reproducir (no se reinicia al recargar);
//   sin controles nativos ni barra de búsqueda (el <audio> no se inserta en la página).
// · Pantalla completa obligatoria (v0.3): mientras la ventana no ocupe toda la pantalla o no tenga el foco, la vista se BLOQUEA
//   (no se ven preguntas). El examen no inicia hasta estar a pantalla completa.
// · Integridad: o.incidentes = [] persistente; 1.º y 2.º → advertencia; al 3.º se cierra y se entrega con lo respondido.
import { h, mount, btn, toast, mmss } from './util.js'; import { tituloEN, tipoEN } from './en.js'; import { vigilar, evidencia, TIPOS, TIPOS_EN, pedirPantallaCompleta, fsSupported, standalone, fsElement } from './integrity.js';
const L = 'ABCD', MAX_AVISOS = 2;
const NOMBRE = { A: 'Preguntas CON audio (listening)', T: 'Preguntas SIN audio (reading)' }; // para la evidencia (la ve el Administrador)
const NAME = { A: 'Questions WITH audio (listening)', T: 'Questions WITHOUT audio (reading)' };
const times = n => n === 1 ? 'time' : 'times';
export function runExam(o) {
  // o: {root, meta:{ti,items}, plan, bloque, onBloque(b), answers, plays, maxPlays, deadline, getAudio, onAnswer, onPlay, incidentes, onIncident(inc), quien:{mat,nom}, onSubmit(motivo)}
  const it = o.meta.items, N = it.length, P = o.plan; let seq = [], i = 0, audio = null, timer, ended = false, view = 'chooser', stopWatch = null, lockEl = null;
  const inc = o.incidentes || (o.incidentes = []), TI = o.etiqueta || tituloEN(o.meta.ti); // v0.4: solo el TIPO de evaluación, nunca la forma
  const left = () => Math.max(0, Math.round((o.deadline - Date.now()) / 1000));
  const stopAudio = () => { if (audio) { audio.onended = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; } };
  const blockOf = k => it[k].au ? 'A' : 'T';
  const setSeq = () => { const f = o.bloque, s = f === 'A' ? 'T' : 'A'; seq = [...P[f], ...P[s]]; };
  const lockMedia = () => { try { if ('mediaSession' in navigator) for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack']) navigator.mediaSession.setActionHandler(a, () => { }); } catch { } };
  function modal(title, text, actions) {
    const ov = h('div', { class: 'ov', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'card modal' }, h('h3', null, title), h('p', null, text), h('div', { class: 'row' }, actions.map(([t, f, c]) => btn(t, () => { ov.remove(); f && f(); }, c)))));
    document.body.append(ov); return ov;
  }
  const unlock = () => { if (lockEl) { lockEl.remove(); lockEl = null; } document.body.classList.remove('locked'); };
  function lock(s, armed) { // vista bloqueada: no se ven las preguntas hasta volver a pantalla completa con el foco
    if (ended) return unlock(); if (s.ok) { if (lockEl) { unlock(); if (audio) stopAudio(); } return; }
    if (audio) { stopAudio(); if (view === 'item') show(); }
    const ios = !fsSupported() && !standalone();
    const why = !armed ? 'The exam can only start in full screen. Other apps must not be visible.' : s.motivo === 'foco' ? 'The exam lost focus: another app or window is active.' : s.motivo === 'ventana' ? 'The exam screen was hidden (you switched apps, opened the app switcher or locked the screen).' : 'The exam is not in full screen, or other apps are visible (Split View, Slide Over, Stage Manager, split screen, floating or resized window).';
    const body = h('div', { class: 'card modal' }, h('h3', null, armed ? 'Exam locked' : 'Full screen required'), h('p', null, why),
      armed ? h('p', null, h('b', null, 'This was recorded as an incident.'), ' Close any other app or window and return to full screen to continue.') : null,
      ios ? h('p', { class: 'mini' }, 'This browser cannot open full screen. On iPhone or iPad: tap Share → «Add to Home Screen», then open the exam from the Home Screen icon. Close Split View and Slide Over first.') : h('p', { class: 'mini' }, 'Close Split View, Slide Over, Stage Manager, split screen and floating windows. The exam must fill the whole screen.'),
      h('div', { class: 'row' }, btn(armed ? 'Return to full screen' : 'Enter full screen', async () => { await pedirPantallaCompleta(); }, 'big')));
    if (!lockEl) { lockEl = h('div', { class: 'ov lock', role: 'dialog', 'aria-modal': 'true' }, body); document.body.append(lockEl); document.body.classList.add('locked'); }
    else lockEl.replaceChildren(body);
  }
  function finish(motivo) { if (ended) return; ended = true; clearInterval(timer); stopAudio(); stopWatch && stopWatch(); unlock(); document.querySelectorAll('.ov').forEach(e => e.remove()); try { if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { } o.onSubmit(motivo); }
  async function incidente(tipo, t) {
    if (ended) return; const n = inc.length + 1, x = view === 'item' ? it[seq[i]] : null, perm = x ? P.op[seq[i]] : [];
    let img = null; try { img = evidencia({ ti: o.etiqueta || o.meta.ti, mat: o.quien?.mat, nom: o.quien?.nom, tipo: TIPOS[tipo] || tipo, n, max: MAX_AVISOS + 1, t, pos: x ? i + 1 : 0, total: N, bloque: x ? NOMBRE[blockOf(seq[i])] : 'Elección de bloque / hoja de respuestas', q: x ? (x.pas ? x.pas.slice(0, 400) + '\n' : '') + (x.q || 'Listen and choose the best answer.') : '', opts: x ? perm.map(k => x.o[k]) : [], sel: x ? perm.indexOf(o.answers[seq[i]]) : -1, audio: x && x.au ? Math.max(0, o.maxPlays - (o.plays[x.n] || 0)) : 0, restante: mmss(left()) }); } catch { }
    const rec = { n, tipo, t, pos: x ? i + 1 : 0, item: x ? x.n : null, img }; inc.push(rec);
    try { await o.onIncident(rec); } catch { }
    if (n > MAX_AVISOS) { toast('Exam closed because of incidents. It was submitted with your answers.'); return finish('incidentes'); }
    modal(`Warning ${n} of ${MAX_AVISOS}`, `Recorded: ${TIPOS_EN[tipo] || tipo}. It was saved as evidence with the time and an image of your exam. ${n === MAX_AVISOS ? 'At the next incident your exam will be closed and graded with the answers you have given.' : `If this happens ${MAX_AVISOS + 1 - n} more times, your exam will be closed and graded with the answers you have given.`}`, [['I understand', null, 'big']]);
  }
  function chooser() {
    view = 'chooser'; stopAudio();
    mount(o.root, h('header', null, h('div', null, h('b', null, TI), h('span', null, 'Choose the block to start with')), h('span', { class: 'timer' }, mmss(left()))),
      h('main', null, h('section', { class: 'card' }, h('h2', null, 'Which questions do you want to start with?'), h('p', { class: 'mini' }, 'The exam has two blocks. When you finish the first one you move on to the other. There is one timer for both. The order of the questions and answer options is different for each cadet.'),
        h('div', { class: 'blk' }, ['A', 'T'].map(b => h('button', { class: 'role', onclick: () => { o.bloque = b; o.onBloque && o.onBloque(b); setSeq(); i = 0; show(); } }, h('i', null, b === 'A' ? '🎧' : '📖'), h('div', null, h('b', null, `Start with the questions ${b === 'A' ? 'WITH audio' : 'WITHOUT audio'}`), h('span', null, `${P[b].length} questions${b === 'A' ? ` · each audio can be played ${o.maxPlays} ${times(o.maxPlays)} at most` : ''}`))))))));
  }
  function overview() {
    view = 'sheet'; stopAudio(); const un = seq.filter(k => o.answers[k] < 0).length;
    const grid = (b, from, to) => h('div', null, h('p', { class: 'mini' }, h('b', null, NAME[b])), h('div', { class: 'sheet' }, seq.slice(from, to).map((k, j) => h('button', { class: 'sh' + (o.answers[k] >= 0 ? ' on' : ''), onclick: () => { i = from + j; show(); } }, `${from + j + 1}`, h('small', null, o.answers[k] >= 0 ? L[P.op[k].indexOf(o.answers[k])] : '·')))));
    const n1 = P[o.bloque].length, b2 = o.bloque === 'A' ? 'T' : 'A';
    mount(o.root, h('header', null, h('div', null, h('b', null, TI), h('span', null, 'Answer sheet')), h('span', { class: 'timer' }, mmss(left()))),
      h('main', null, h('section', { class: 'card' }, h('p', null, un ? `You still have ${un} unanswered ${un === 1 ? 'question' : 'questions'}.` : 'You answered all the questions.'),
        n1 ? grid(o.bloque, 0, n1) : null, seq.length > n1 ? grid(b2, n1, seq.length) : null,
        h('div', { class: 'row' }, btn('Back to the exam', () => show(), 'ghost'), btn('Submit exam', () => modal('Submit your exam?', (un ? `You have ${un} unanswered. ` : '') + 'After submitting you cannot change anything.', [['Cancel', null, 'ghost'], ['Yes, submit', () => finish('cadete')]]))))));
  }
  async function play(x) {
    if (lockEl) return; const used = (o.plays[x.n] || 0); if (used >= o.maxPlays) return toast('No plays left for this audio.');
    const url = await o.getAudio(x.au); if (!url) return toast('Audio not available. Tell your proctor.');
    stopAudio(); o.plays[x.n] = used + 1; try { await o.onPlay(x.n, used + 1); } catch { } // se guarda ANTES de sonar
    audio = new Audio(); audio.preload = 'auto'; audio.controls = false; audio.src = url; lockMedia(); show(true);
    audio.onended = () => { stopAudio(); if (view === 'item') show(true); }; audio.play().catch(() => toast('The audio could not be played.'));
  }
  function show(keepAudio) {
    view = 'item'; if (!keepAudio) stopAudio(); const k = seq[i], x = it[k], perm = P.op[k], rem = o.maxPlays - (o.plays[x.n] || 0), playing = audio && !audio.paused && !audio.ended, b = blockOf(k), n1 = P[o.bloque].length;
    const firstOf2 = i === n1 && n1 > 0 && n1 < seq.length;
    mount(o.root, h('header', null, h('div', null, h('b', null, TI), h('span', null, `${i < n1 ? 'Block 1' : 'Block 2'} · ${b === 'A' ? 'with audio' : 'without audio'} · Question ${i + 1} of ${N}`)), h('span', { class: 'timer', id: 'tm', title: 'Time left' }, mmss(left()))),
      h('div', { class: 'prog2' }, (() => { const bar = h('i'); bar.style.width = (100 * o.answers.filter(a => a >= 0).length / N) + '%'; return bar; })()),
      h('main', null, h('section', { class: 'card' },
        firstOf2 ? h('p', { class: 'pill warn' }, `Block 2 starts: ${NAME[b]}`) : null,
        h('span', { class: 'tag' }, (x.sec === 'L' ? 'Listening' : 'Reading') + (tipoEN(x.tp) ? ' · ' + tipoEN(x.tp) : '')),
        x.pas ? h('div', { class: 'pas' }, x.pas) : null,
        x.au ? h('div', { class: 'audio' }, h('button', { class: 'btn big', disabled: rem <= 0 || playing, onclick: () => play(x) }, playing ? '🔊 Playing…' : rem <= 0 ? 'No plays left' : `▶ Listen (${rem} ${times(rem)} left)`), h('p', { class: 'mini' }, `Plays used: ${o.plays[x.n] || 0} of ${o.maxPlays}`)) : null,
        x.q ? h('p', { class: 'q' }, x.q) : (x.au ? h('p', { class: 'q' }, 'Listen and choose the best answer.') : null),
        h('div', { class: 'opts' }, perm.map((ko, j) => h('button', { class: o.answers[k] === ko ? 'sel' : '', onclick: () => { o.answers[k] = ko; o.onAnswer(k, ko); show(true); } }, h('b', null, L[j]), h('span', null, x.o[ko])))),
        o.answers[k] >= 0 ? h('p', { class: 'mini' }, 'You can change your answer until you submit.') : null)),
      h('footer', null, btn('← Previous', () => { i = Math.max(0, i - 1); show(); }, 'ghost'), btn('Sheet', () => overview(), 'ghost'), i < N - 1 ? btn(i === n1 - 1 ? 'Next block →' : 'Next →', () => { i++; show(); }) : btn('Review and submit', () => overview())));
  }
  // arranque
  for (const k of ['A', 'T']) if (!P[k].length) o.bloque = o.bloque || (k === 'A' ? 'T' : 'A');
  timer = setInterval(() => { const s = left(); document.querySelectorAll('.timer').forEach(e => e.textContent = mmss(s)); if (s <= 0 && !ended) { toast('Time is up: your exam is being submitted.'); finish('tiempo'); } }, 1000);
  if (inc.length > MAX_AVISOS) { setTimeout(() => finish('incidentes'), 0); return { stop() { } }; }
  if (o.bloque) { setSeq(); i = Math.min(o.pos || 0, seq.length - 1); show(); } else chooser();
  stopWatch = vigilar((tipo, t) => incidente(tipo, t), { onEstado: lock });
  return { stop() { ended = true; clearInterval(timer); stopAudio(); stopWatch && stopWatch(); unlock(); } };
}
