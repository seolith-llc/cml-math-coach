import type { Category, Grade } from '../core/types';
import { dayStreak, dueReviews, load, reset, save } from '../core/storage';
import { statFor, weakestTopics } from '../core/mastery';
import { TOPICS, makeProblem, topicById, topicsForGrade } from '../content/topics';
import { CONTEST_TIPS, FOUR_STEPS, STRATEGIES } from '../content/strategies';
import { configureSpeech, isAppleMobile, isStandalone, listVoices, speak, stopSpeaking, ttsSupported, voicesReady } from '../voice/speech';
import { sttSupported, COMMAND_HELP } from '../voice/recognition';
import { h, rich, svg, toast } from './dom';
import type { View } from './app';

const CATEGORY_ICON: Record<Category, string> = {
  'Number sense': '🔢', 'Word problems': '📝', Money: '🪙', 'Time & calendar': '🕒', Measurement: '📏', Logic: '🧩', Counting: '🔺', Puzzles: '🧠'
};

function meter(value: number | undefined) {
  const pct = Math.round((value ?? 0) * 100);
  return h('span', { class: 'meter', title: value === undefined ? 'Not tried yet' : `Mastery ${pct}%` }, h('span', { style: `width:${value === undefined ? 0 : Math.max(6, pct)}%` }));
}

export function homeView(): View {
  const state = load();
  const s = state.settings;
  const grade = s.grade as Grade;
  const due = dueReviews(state, grade).length;
  const streak = dayStreak(state);
  const setGrade = (g: Grade) => {
    s.grade = g;
    save(state);
    location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const greet = `Hi${s.name ? ' ' + s.name : ''}! Ready to practice Grade ${grade} math?`;
  return {
    title: 'Math Coach',
    el: h('section', {},
      h('div', { class: 'hero' },
        h('h1', {}, greet),
        h('p', { class: 'muted' }, 'Contest-style problems with a coach that listens, gives hints and explains your mistakes.'),
        h('div', { class: 'grade-toggle', role: 'group', 'aria-label': 'Grade' },
          ...([2, 3] as Grade[]).map((g) => h('button', { class: `btn ${g === grade ? 'primary' : ''}`, 'aria-pressed': String(g === grade), onclick: () => setGrade(g) }, `Grade ${g}`))),
        h('button', { class: 'btn ghost', onclick: () => speak(`${greet} Choose smart practice, a mock meet, or learn a strategy.`) }, '🔊 Hear this'),
        streak ? h('p', { class: 'streak' }, `🔥 ${streak}-day streak`) : null
      ),
      h('div', { class: 'tiles' },
        tile('#/practice', '🎯', 'Smart practice', 'A mix that focuses on what you need most'),
        tile('#/meet', '⏱', 'Mock meet', '6 questions · 30 minutes, just like the real thing'),
        tile('#/learn', '📚', 'Learn topics', `${topicsForGrade(grade).length} topics with tips and worked examples`),
        tile('#/review', '🔁', 'Review mistakes', due ? `${due} problem${due > 1 ? 's' : ''} ready to retry` : 'Nothing due, nice!'),
        tile('#/toolkit', '🧭', 'Problem-solving toolkit', 'The 4 steps and 10 strategies'),
        tile('#/progress', '📈', 'My progress', 'See your strengths and your next goals')
      ),
      !sttSupported()
        ? h('p', { class: 'note' }, isAppleMobile() && isStandalone()
          ? 'On iPad, voice answers only work when Math Coach is opened in Safari, not from the Home Screen icon. Reading aloud and typing work everywhere.'
          : 'Tip: voice answers work in Chrome, Edge and Safari. In this browser the coach can still read aloud, and you can type your answers.')
        : null
    )
  };
}

function tile(href: string, icon: string, title: string, sub: string) {
  return h('a', { class: 'tile', href }, h('span', { class: 'tile-icon' }, icon), h('strong', {}, title), h('small', {}, sub));
}

export function learnView(): View {
  const state = load();
  const grade = state.settings.grade as Grade;
  const byCat = new Map<Category, typeof TOPICS>();
  for (const t of topicsForGrade(grade)) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]);
  return {
    title: 'Learn',
    el: h('section', {},
      h('p', { class: 'muted' }, 'Pick a topic to learn the idea, see a worked example, and practice it.'),
      ...[...byCat.entries()].map(([cat, topics]) =>
        h('div', { class: 'card' },
          h('h2', {}, `${CATEGORY_ICON[cat]} ${cat}`),
          h('ul', { class: 'topic-list' }, ...topics.map((t) =>
            h('li', {}, h('a', { href: `#/learn/${t.id}` }, t.title), meter(statFor(state, grade, t.id)?.mastery))))))
    )
  };
}

export function topicView(id: string): View {
  const state = load();
  const grade = state.settings.grade as Grade;
  const t = topicById(id);
  if (!t) return { title: 'Not found', el: h('p', {}, 'Topic not found.') };
  const g = t.grades.includes(grade) ? grade : t.grades[0];
  const example = makeProblem(t, g, 2, 20261101 + id.length);
  const stepsList = h('ol', { class: 'solution' });
  let shown = 0;
  const stepBtn = h('button', {
    class: 'btn', onclick: () => {
      if (shown >= example.steps.length) return;
      const s = example.steps[shown++];
      stepsList.append(h('li', {}, s));
      speak(s);
      if (shown >= example.steps.length) stepBtn.disabled = true;
    }
  }, 'Show next step ▶');
  const lesson = `${t.title}. ${t.guide.idea} Tips: ${t.guide.tips.join(' ')} Watch out: ${t.guide.traps.join(' ')}`;
  return {
    title: t.title,
    el: h('section', {},
      h('div', { class: 'card' },
        h('p', { class: 'chip ghost' }, `🧭 Strategy: ${t.strategy}`),
        h('p', { class: 'lead' }, t.guide.idea),
        h('h3', {}, 'Tips'), h('ul', {}, ...t.guide.tips.map((x) => h('li', {}, x))),
        h('h3', {}, 'Watch out'), h('ul', { class: 'traps' }, ...t.guide.traps.map((x) => h('li', {}, x))),
        h('button', { class: 'btn ghost', onclick: () => speak(lesson) }, '🔊 Read the lesson to me')),
      h('div', { class: 'card' },
        h('h3', {}, 'Worked example'),
        h('p', { class: 'question' }, rich(example.text)),
        example.figure ? svg(example.figure) : null,
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => speak(example.speech ?? example.text) }, '🔊 Read'), stepBtn),
        stepsList),
      h('div', { class: 'row center' }, h('a', { class: 'btn primary big', href: `#/practice/${t.id}` }, `Practice: ${t.title} →`))
    ),
    destroy: stopSpeaking
  };
}

export function toolkitView(): View {
  const read = () => speak(`Four steps to solve any problem. ${FOUR_STEPS.map((s) => s.title.replace(/^\d\.\s*/, '') + '. ' + s.text).join(' ')}`);
  return {
    title: 'Problem-solving toolkit',
    el: h('section', {},
      h('div', { class: 'card' },
        h('h2', {}, 'The 4 steps'),
        h('div', { class: 'steps4' }, ...FOUR_STEPS.map((s) => h('div', { class: 'step4' }, h('strong', {}, s.title), h('p', {}, s.text)))),
        h('button', { class: 'btn ghost', onclick: read }, '🔊 Read the 4 steps')),
      h('div', { class: 'card' },
        h('h2', {}, 'Strategies'),
        h('dl', { class: 'strategies' }, ...Object.entries(STRATEGIES).flatMap(([k, v]) => [
          h('dt', {}, k, ' ', h('button', { class: 'icon-btn', 'aria-label': `Read ${k}`, onclick: () => speak(`${k}. ${v}`) }, '🔊')), h('dd', {}, v)]))),
      h('div', { class: 'card' }, h('h2', {}, 'Contest-day tips'), h('ul', {}, ...CONTEST_TIPS.map((x) => h('li', {}, x)))),
      h('div', { class: 'card' }, h('h2', {}, 'Talking to the coach'), h('p', {}, COMMAND_HELP))
    ),
    destroy: stopSpeaking
  };
}

export function progressView(): View {
  const state = load();
  const grade = state.settings.grade as Grade;
  const topics = topicsForGrade(grade);
  const stats = topics.map((t) => ({ t, s: statFor(state, grade, t.id) }));
  const attempts = stats.reduce((a, x) => a + (x.s?.attempts ?? 0), 0);
  const correct = stats.reduce((a, x) => a + (x.s?.correct ?? 0), 0);
  const weak = weakestTopics(state, grade, topics);
  const meets = state.meets.filter((m) => m.grade === grade).slice(-8).reverse();
  return {
    title: 'My progress',
    el: h('section', {},
      h('div', { class: 'stats' },
        stat('Problems tried', attempts), stat('Correct first try', attempts ? `${Math.round((correct / attempts) * 100)}%` : '–'),
        stat('Day streak', `🔥 ${dayStreak(state)}`), stat('Mock meets', meets.length)),
      weak.length ? h('div', { class: 'card' }, h('h2', {}, 'Next goals'), h('p', {}, 'These topics need a bit more practice:'),
        h('div', { class: 'row' }, ...weak.map((t) => h('a', { class: 'btn', href: `#/learn/${t.id}` }, t.title)))) : null,
      h('div', { class: 'card' }, h('h2', {}, 'Topics'),
        h('ul', { class: 'topic-list' }, ...stats.map(({ t, s }) =>
          h('li', {}, h('a', { href: `#/learn/${t.id}` }, t.title), h('small', { class: 'muted' }, s ? `${s.correct}/${s.attempts}` : 'new'), meter(s?.mastery))))),
      meets.length ? h('div', { class: 'card' }, h('h2', {}, 'Recent meets'),
        h('ul', { class: 'topic-list' }, ...meets.map((m) => h('li', {}, new Date(m.date).toLocaleDateString(), h('strong', {}, `${m.score} / ${m.total}`), h('small', { class: 'muted' }, `${Math.round(m.seconds / 60)} min`))))) : null
    )
  };
}

function stat(label: string, value: string | number) {
  return h('div', { class: 'stat' }, h('strong', {}, String(value)), h('small', {}, label));
}

export function settingsView(): View {
  const state = load();
  const s = state.settings;
  const voiceSel = h('select', { 'aria-label': 'Voice', onchange: () => { s.voiceURI = voiceSel.value || undefined; save(state); configureSpeech({ voiceURI: s.voiceURI }); speak('This is my new voice.'); } },
    h('option', { value: '' }, 'Automatic'));
  voicesReady().then(() => {
    for (const v of listVoices()) voiceSel.append(h('option', { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, `${v.name} (${v.lang})`));
  });
  const rate = h('input', { type: 'range', min: '0.6', max: '1.4', step: '0.05', value: String(s.rate), oninput: () => { s.rate = +rate.value; configureSpeech({ rate: s.rate }); save(state); }, onchange: () => speak('This is how fast I talk.') });
  const check = (key: 'autoRead' | 'handsFree' | 'speakFeedback', label: string, disabled = false) => {
    const box = h('input', { type: 'checkbox', checked: s[key], disabled, onchange: () => { s[key] = box.checked; save(state); } });
    return h('label', { class: 'check' }, box, ' ', label);
  };
  const name = h('input', { type: 'text', value: s.name, placeholder: 'First name (optional)', oninput: () => { s.name = name.value.trim(); save(state); } });
  return {
    title: 'Settings',
    el: h('section', {},
      h('div', { class: 'card form' },
        h('label', {}, 'Name', name),
        h('label', {}, 'Grade', h('select', { onchange: (e: Event) => { s.grade = +(e.target as HTMLSelectElement).value as Grade; save(state); } },
          h('option', { value: '2', selected: s.grade === 2 }, 'Grade 2'), h('option', { value: '3', selected: s.grade === 3 }, 'Grade 3'))),
        ttsSupported() ? h('label', {}, 'Voice', voiceSel) : h('p', { class: 'note' }, 'Read-aloud is not supported in this browser.'),
        h('label', {}, 'Talking speed', rate),
        check('autoRead', 'Read each question out loud automatically', !ttsSupported()),
        check('speakFeedback', 'Say feedback and solutions out loud', !ttsSupported()),
        check('handsFree', 'Hands-free voice mode (listen for answers automatically)', !sttSupported())),
      h('div', { class: 'card' },
        h('h2', {}, 'Privacy'),
        h('p', { class: 'muted' }, 'Progress is saved only on this device. Voice recognition is handled by your browser, and some browsers (like Chrome) send the audio to their speech service.'),
        h('button', { class: 'btn danger', onclick: () => { if (confirm('Erase all progress on this device?')) { reset(); toast('Progress erased'); location.hash = '#/'; } } }, 'Reset progress'))
    )
  };
}
