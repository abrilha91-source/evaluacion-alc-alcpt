// Reglas del examen que lee el cadete antes de empezar (inglés; compartido por ambas versiones).
import { h } from './util.js';
export const reglas = (du, pl, extra) => h('ul', { class: 'mini' },
  du ? h('li', null, `The time (${du} min) starts when you tap «Start» and does not stop.`) : h('li', null, 'The time starts when you begin and is controlled by the server.'),
  h('li', null, h('b', null, 'The exam runs in FULL SCREEN only.'), ' On iPhone/iPad, if full screen is not offered, install the app first (Share → «Add to Home Screen») and open it from the Home Screen icon.'),
  h('li', null, 'Do not open the app switcher, Split View, Slide Over, Stage Manager, split screen or floating windows; do not switch apps or windows, take screenshots or translate the page. Each time an incident is recorded with the time and an image, and the exam is locked until you return to full screen.'),
  h('li', null, '1st and 2nd incident: warning. 3rd incident: the exam is closed and graded with the answers you have given.'),
  h('li', null, `First you choose which block to start with: questions WITH audio or WITHOUT audio. Each audio can be played ${pl} ${pl === 1 ? 'time' : 'times'}. The order of questions and options is different for each cadet.`),
  extra ? h('li', null, extra) : null);
