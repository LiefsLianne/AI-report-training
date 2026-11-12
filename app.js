/* Paso a Paso — a Cuban salsa (casino) trainer.
   Three parts: MOVES (the dance data), the audio engine (a synthesised practice band
   on a Web Audio clock), and the stage (SVG drawn every frame from that same clock). */
(() => {
'use strict';

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, f) => a + (b - a) * f;
const ease = f => f * f * (3 - 2 * f);
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, text) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (text != null) el.textContent = text;
  return el;
};
// localStorage can be missing or blocked, so every access is guarded.
const store = {
  get(k, d) { try { const v = localStorage.getItem('pap:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pap:' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ---------- the dance data ---------- */
// Footwork: one entry per count (index 0 = count 1). [foot, x, y] is where that foot lands;
// null is a pause. Coordinates are on a 100 x 100 floor, dancer facing up.
const NEUTRAL = { L: [44, 55], R: [56, 55] };
const FOOT_PATH = 'M0-8C3.3-8 3.9-4.5 3.5-1 3.2 1.5 2.7 2.6 2.7 4.6 2.7 7 1.7 8 0 8-1.7 8-2.7 7-2.7 4.6-2.7 2.6-3.2 1.5-3.5-1-3.9-4.5-3.3-8 0-8Z';

// Partner figures: one keyframe per count. Each dancer is [x, y, facing] with facing in
// degrees (0 = up, clockwise positive, so "turning right" increases it).
const k = (lx, ly, la, fx, fy, fa, hold) => ({ L: [lx, ly, la], F: [fx, fy, fa], hold });
const OPEN = k(50, 64, 0, 50, 36, 180, 'LR');          // open position, as in guapea
const CLOSED = k(46, 60, 90, 58, 70, -60, 'closed');   // follower on the leader's right

const ENCHUFLA = [
  k(50, 67, 0, 50, 33, 180, 'LR'),
  k(47, 62, 15, 50, 40, 180, 'LR'),
  k(42, 53, 50, 52, 50, 150, 'LR'),
  k(42, 50, 85, 54, 57, 90, 'LR'),
  k(43, 53, 100, 57, 63, 30, 'LR'),
  k(44, 57, 100, 59, 68, -20, 'LR'),
  k(46, 60, 92, 58, 70, -50, 'closed'),
  CLOSED,
];
const DILE_QUE_NO = (h = 'closed') => [
  k(49, 60, 80, 60, 73, -55, h),
  k(50, 63, 55, 59, 71, -45, h),
  k(50, 64, 30, 57, 66, -30, h),
  k(50, 64, 20, 56, 61, -20, h),
  k(50, 64, 10, 54, 53, -10, 'LR'),
  k(50, 64, 5, 52, 44, -60, 'LR'),
  k(50, 64, 0, 50, 37, -150, 'LR'),
  OPEN,
];
const VACILALA = (h, free, end) => [
  k(50, 66, 0, 50, 37, 180, h),
  k(48, 65, 20, 51, 44, 180, h),
  k(44, 63, 45, 53, 52, 200, free),
  k(42, 62, 65, 55, 58, 280, free),
  k(43, 61, 80, 57, 64, 40, free),
  k(45, 60, 88, 58, 68, 160, free),
  k(46, 60, 90, 58, 70, 270, free),
  k(46, 60, 90, 58, 70, 300, end),
];
const EXHIBELA = [
  k(47, 60, 90, 60, 72, -60, 'LR'),
  k(46, 61, 90, 59, 70, -30, 'LR'),
  k(46, 60, 90, 58, 68, 10, 'LR'),
  k(46, 60, 90, 58, 68, 70, 'LR'),
  k(46, 60, 90, 58, 69, 150, 'LR'),
  k(46, 60, 90, 58, 70, 230, 'LR'),
  k(46, 60, 90, 58, 70, 290, 'closed'),
  CLOSED,
];
const ENCHUFLA_HALF = [
  ENCHUFLA[0], ENCHUFLA[1], ENCHUFLA[2], ENCHUFLA[3],
  ENCHUFLA[2], ENCHUFLA[1], k(50, 65, 0, 50, 35, 180, 'LR'), OPEN,
];

const DQN_ROWS = [
  { c: '1 · 2 · 3', B: 'Dile que no. The leader opens to the left and clears the path.' },
  { c: '5 · 6 · 7', B: 'The follower walks across and turns to face the leader. You are back in open position.' },
];

const MOVES = [
  {
    id: 'basico', level: 1, view: 'feet', bars: 1, loop: true, mirror: 'x', solo: true,
    name: 'Paso básico', gloss: 'the back basic',
    lede: 'Home base. A small rock step backwards on alternating feet: three steps, one pause, twice in every eight counts.',
    steps: [['L', 44, 69], ['R', 56, 55], ['L', 44, 55], null, ['R', 56, 69], ['L', 44, 55], ['R', 56, 55], null],
    rows: [
      { c: '1 · 2 · 3', L: 'Left foot steps back, right foot steps in place, left foot returns beside it. Pause on 4.', F: 'Right foot steps back, left foot steps in place, right foot returns beside it. Pause on 4.' },
      { c: '5 · 6 · 7', L: 'Right foot steps back, left foot steps in place, right foot returns. Pause on 8.', F: 'Left foot steps back, right foot steps in place, left foot returns. Pause on 8.' },
    ],
    tips: [
      'Keep the steps small. At social tempo a step is no longer than your own foot.',
      'Stay on the balls of your feet with soft knees. The hip movement comes from bending and straightening the knees, not from pushing the hips around.',
      'Counts 4 and 8 are pauses, not extra steps. Let the body settle; do not freeze.',
    ],
  },
  {
    id: 'lateral', level: 1, view: 'feet', bars: 1, loop: true, mirror: 'x', solo: true,
    name: 'Paso lateral', gloss: 'the side basic',
    lede: 'The same rhythm, travelling sideways. Good for getting your weight fully onto each foot.',
    steps: [['L', 30, 55], ['R', 56, 55], ['L', 44, 55], null, ['R', 70, 55], ['L', 44, 55], ['R', 56, 55], null],
    rows: [
      { c: '1 · 2 · 3', L: 'Left foot steps to the side, right foot steps in place, left foot closes. Pause on 4.', F: 'Right foot steps to the side, left foot steps in place, right foot closes. Pause on 4.' },
      { c: '5 · 6 · 7', L: 'Right foot steps to the side, left foot steps in place, right foot closes. Pause on 8.', F: 'Left foot steps to the side, right foot steps in place, left foot closes. Pause on 8.' },
    ],
    tips: [
      'Move your whole body over the stepping foot. If you can lift the other foot, the weight has arrived.',
      'Shoulders stay level and quiet while the feet and knees do the work.',
    ],
  },
  {
    id: 'adelante', level: 1, view: 'feet', bars: 1, loop: true, mirror: 'xy', solo: true,
    name: 'Adelante y atrás', gloss: 'forward and back',
    lede: 'The basic used in closed position. One of you steps forward while the other steps back, so you move as one.',
    steps: [['L', 44, 41], ['R', 56, 55], ['L', 44, 55], null, ['R', 56, 69], ['L', 44, 55], ['R', 56, 55], null],
    rows: [
      { c: '1 · 2 · 3', L: 'Left foot steps forward, right foot steps in place, left foot returns. Pause on 4.', F: 'Right foot steps back, left foot steps in place, right foot returns. Pause on 4.' },
      { c: '5 · 6 · 7', L: 'Right foot steps back, left foot steps in place, right foot returns. Pause on 8.', F: 'Left foot steps forward, right foot steps in place, left foot returns. Pause on 8.' },
    ],
    tips: [
      'In closed hold your partner\'s back step makes room for your forward step. Match its size.',
      'Lead and follow from the body. The arms keep their shape and carry the movement; they do not push.',
    ],
  },
  {
    id: 'guapea', level: 1, view: 'feet', bars: 1, loop: true, mirror: 'x', solo: true,
    name: 'Guapea', gloss: 'the open basic',
    lede: 'The resting step of casino and the home position of every rueda. Partners face each other, the leader\'s left hand holding the follower\'s right. Both rock back on 1 and meet in the middle on 5.',
    steps: [['L', 44, 69], ['R', 56, 55], ['L', 44, 55], null, ['R', 56, 43], ['L', 44, 55], ['R', 56, 55], null],
    rows: [
      { c: '1 · 2 · 3', L: 'Left foot steps back, right foot in place, left foot steps forward again toward your partner. Pause on 4.', F: 'Right foot steps back, left foot in place, right foot steps forward again toward your partner. Pause on 4.' },
      { c: '5 · 6 · 7', L: 'Right foot takes a small step forward and your free right palm meets your partner\'s left. Left foot in place, right foot back to neutral. Pause on 8.', F: 'Left foot takes a small step forward and your free left palm meets your partner\'s right. Right foot in place, left foot back to neutral. Pause on 8.' },
    ],
    tips: [
      'The joined arms work like elastic: they stretch on 1 and compress on 5. That stretch powers every figure that follows.',
      'Do not pull with the arm. Step back and let your body weight create the tension.',
    ],
  },
  {
    id: 'dqn', level: 2, view: 'floor', bars: 1, loop: false,
    name: 'Dile que no', gloss: '“tell him no”',
    lede: 'Casino\'s cross-body lead. It takes the follower from the leader\'s right side across to open position, and it finishes almost every figure you will learn.',
    start: CLOSED, kf: DILE_QUE_NO(),
    rows: [
      { c: '1 · 2 · 3', L: 'Left foot forward on 1. On 2 and 3 open your body to the left like a door, clearing a path in front of you. Your right hand stays on your partner\'s back.', F: 'Right foot back, left foot in place, right foot forward. You are about to be sent across.' },
      { c: '5 · 6 · 7', L: 'Guide your partner across with the right hand, then let go and keep the left-to-right hand hold. Step in place and finish face to face.', F: 'Walk forward across the leader on 5 and 6, then turn left on 7 to face them.' },
    ],
    tips: [
      'Leaders: the lead happens between 3 and 5. Any earlier and you pull your partner off their back step.',
      'Followers: walk first, turn last. Two clear forward steps, and the turn comes with the third.',
    ],
  },
  {
    id: 'enchufla', level: 2, view: 'floor', bars: 2, loop: true, call: true,
    name: 'Enchufla', gloss: '“plug it in”',
    lede: 'You swap places while the follower turns left under the joined hands. A dile que no brings you home.',
    kf: [...ENCHUFLA, ...DILE_QUE_NO()],
    rows: [
      { c: '1 · 2 · 3', L: 'Rock back on 1. On 2 and 3 lift the left hand and step forward to your left, turning right as your partner passes in front of you.', F: 'Rock back on 1 and step forward on 2. On 3 pivot to the left under the raised arm.' },
      { c: '5 · 6 · 7', L: 'Finish turning to the right and step in next to your partner. Lower the hands and place your right hand on their back.', F: 'Complete the half turn to the left and keep walking: left, right, left. You end on the leader\'s right side.' },
      ...DQN_ROWS,
    ],
    tips: [
      'Leaders: step out of the way. The follower travels in a straight line and you move around it.',
      'Keep the raised hand loose so the follower\'s hand can rotate inside yours.',
    ],
  },
  {
    id: 'exhibela', level: 2, view: 'floor', bars: 2, loop: false,
    name: 'Exhíbela', gloss: '“show her off”',
    lede: 'The underarm right turn from closed position: the follower turns on the spot and comes straight back.',
    start: CLOSED, kf: [...EXHIBELA, ...DILE_QUE_NO()],
    rows: [
      { c: '1 · 2 · 3', L: 'Basic step in closed position. Raise the left hand by 3 to announce the turn.', F: 'Basic step. As the hand lifts, step forward under it.' },
      { c: '5 · 6 · 7', L: 'Draw a small circle above your partner\'s head, then collect them back into closed position.', F: 'Turn right under the arm with three small steps, one full turn, and return to the leader\'s right side.' },
      ...DQN_ROWS,
    ],
    tips: [
      'Leaders: keep the hand just above your partner\'s head. Never press down and never crank the arm.',
      'Followers: the turn is three small steps, not a spin on one foot. Look for your partner as you come around.',
    ],
  },
  {
    id: 'vacilala', level: 2, view: 'floor', bars: 2, loop: true, call: true,
    name: 'Vacílala', gloss: '“check her out”',
    lede: 'The follower\'s solo moment. The leader lets go, and the follower turns right while walking past.',
    kf: [...VACILALA('LR', 'none', 'closed'), ...DILE_QUE_NO()],
    rows: [
      { c: '1 · 2 · 3', L: 'Rock back, lead your partner forward with the left hand, and release it on 3 with a small impulse to their right.', F: 'Walk forward on 1, 2, 3 toward the leader\'s right side.' },
      { c: '5 · 6 · 7', L: 'Step aside and watch. That is where the name comes from. Collect your partner on 7.', F: 'Turn to the right on your own while you keep travelling. Finish on the leader\'s right, facing them.' },
      ...DQN_ROWS,
    ],
    tips: [
      'Followers: keep walking through the turn. Three steps on 5, 6, 7 carry you around.',
      'Leaders: release early enough. A late release drags your partner off balance.',
    ],
  },
  {
    id: 'sombrero', level: 3, view: 'floor', bars: 2, loop: true, call: true,
    name: 'Sombrero', gloss: '“hat”',
    lede: 'A vacílala with both hands held, right hands on top. The arms finish resting over both partners\' shoulders like the brim of a hat.',
    kf: [...VACILALA('double', 'double', 'double'), ...DILE_QUE_NO('double')],
    rows: [
      { c: '1 · 2 · 3', L: 'Hands crossed, right over left. Rock back, then lead forward and raise both hands.', F: 'Walk forward on 1, 2, 3, exactly as in vacílala.' },
      { c: '5 · 6 · 7', L: 'As your partner turns right, lower your right hand behind their neck and your left hand behind your own.', F: 'Turn right under both arms. You finish side by side with the arms resting on your shoulders.' },
      { c: '1 · 2 · 3', B: 'Dile que no. Lift the hands back over both heads as you begin.' },
      { c: '5 · 6 · 7', B: 'The follower walks across and you return to open position.' },
    ],
    tips: [
      'Right hands must be on top before you start. Set that up during the guapea before it.',
      'Keep the elbows high as the hands come down so nobody gets a forearm in the face.',
    ],
  },
  {
    id: 'doble', level: 3, view: 'floor', bars: 3, loop: true, call: true,
    name: 'Enchufla doble', gloss: '“double plug”',
    lede: 'An enchufla that is called back halfway, then goes all the way through the second time.',
    kf: [...ENCHUFLA_HALF, ...ENCHUFLA, ...DILE_QUE_NO()],
    rows: [
      { c: '1 · 2 · 3', L: 'Start an enchufla, but stop your partner halfway with the raised hand at shoulder height.', F: 'Rock back, step forward and begin the turn to the left.' },
      { c: '5 · 6 · 7', L: 'Send your partner back the way they came, into open position.', F: 'Unwind to the right and return to your own place.' },
      { c: '1 · 2 · 3', B: 'A full enchufla: the follower turns left under the arm and you swap places.' },
      { c: '5 · 6 · 7', B: 'The leader steps in beside the follower, right hand on their back.' },
      ...DQN_ROWS,
    ],
    tips: [
      'The stop on 3 is a clear, soft block. The follower should feel a wall, not a shove.',
      'Count all three eights out loud at first. It is easy to rush the second enchufla.',
    ],
  },
];
const MOVE = Object.fromEntries(MOVES.map(m => [m.id, m]));
const LEVELS = [
  { n: 1, title: 'Level 1 · Pasos, footwork you can practise alone' },
  { n: 2, title: 'Level 2 · Figuras, your first partner figures' },
  { n: 3, title: 'Level 3 · Combinaciones, building on them' },
];

// The follower's footwork is the leader's mirrored: opposite foot, flipped left-right,
// and for forward/back steps flipped front-back too.
function stepsFor(mv, role) {
  if (role === 'leader') return mv.steps;
  return mv.steps.map(s => s && [s[0] === 'L' ? 'R' : 'L', 100 - s[1], mv.mirror === 'xy' ? 110 - s[2] : s[2]]);
}

/* ---------- state ---------- */
const state = {
  role: store.get('role', 'leader') === 'follower' ? 'follower' : 'leader',
  moveId: MOVE[store.get('move', '')] ? store.get('move') : 'basico',
  learned: new Set(store.get('learned', []).filter(id => MOVE[id])),
};
const manual = { t: 0 };          // the count shown while paused
const learn = { startBar: 0 };    // the bar on which the selected move last restarted
const callable = MOVES.filter(m => m.call);
const caller = {
  on: false, plan: [], lastPick: '',
  voice: store.get('voice', true),
  pool: new Set(store.get('pool', callable.map(m => m.id)).filter(id => MOVE[id] && MOVE[id].call)),
};
const selected = () => MOVE[state.moveId];

/* ---------- audio engine ---------- */
// A step is an eighth note: 16 steps make one eight-count. The scheduler queues sounds a
// little ahead on the audio clock, and the drawing code reads the same clock, so sound and
// picture cannot drift apart.
const eng = {
  ctx: null, master: null, noise: null, playing: false, timer: null,
  bpm: clamp(store.get('bpm', 120), 80, 220),
  step: 0, bar: 0, next: 0, events: [],
  layers: Object.assign({ clave: true, campana: true, conga: true, bajo: true, guiro: false }, store.get('layers', {})),
  clave: store.get('clave', '23') === '32' ? '32' : '23',
};
const INSTRUMENTS = [
  { id: 'clave', name: 'Clave' },
  { id: 'campana', name: 'Campana' },
  { id: 'conga', name: 'Conga' },
  { id: 'bajo', name: 'Bajo' },
  { id: 'guiro', name: 'Güiro' },
];
// 0 = silent, 1 = light stroke, 2 = medium, 3 = accent.
function patternFor(id) {
  const p = new Array(16).fill(0);
  if (id === 'clave') (eng.clave === '23' ? [2, 4, 8, 11, 14] : [0, 3, 6, 10, 12]).forEach(i => { p[i] = 3; });
  if (id === 'campana' || id === 'guiro') [0, 4, 8, 12].forEach(i => { p[i] = 3; p[i + 2] = 1; p[i + 3] = 1; });
  if (id === 'conga') return [1, 1, 2, 1, 1, 1, 3, 3, 1, 1, 2, 1, 1, 1, 3, 3];
  if (id === 'bajo') [3, 6, 11, 14].forEach(i => { p[i] = 3; });
  return p;
}
let patterns = {};
const refreshPatterns = () => { patterns = Object.fromEntries(INSTRUMENTS.map(i => [i.id, patternFor(i.id)])); };
refreshPatterns();

function ensureCtx() {
  if (eng.ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ctx = eng.ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  eng.master = ctx.createGain();
  eng.master.gain.value = 0.85;
  eng.master.connect(comp);
  comp.connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  eng.noise = buf;
  return true;
}
function envelope(gain, t, peak, decay, attack = 0.002) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function tone(type, freq, t, peak, decay, opts = {}) {
  const ctx = eng.ctx, osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + decay);
  envelope(g, t, peak, decay);
  let node = osc;
  if (opts.filter) {
    const f = ctx.createBiquadFilter();
    f.type = opts.filter; f.frequency.value = opts.cutoff; f.Q.value = opts.q || 1;
    node.connect(f); node = f;
  }
  node.connect(g); g.connect(eng.master);
  osc.start(t); osc.stop(t + decay + 0.05);
}
function hiss(t, peak, decay, cutoff, q, attack) {
  const ctx = eng.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = eng.noise;
  f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = q;
  envelope(g, t, peak, decay, attack);
  src.connect(f); f.connect(g); g.connect(eng.master);
  src.start(t, Math.random() * 0.2); src.stop(t + decay + (attack || 0) + 0.05);
}
const BASS_ROOT = [110, 146.83, 164.81, 146.83];   // A, D, E, D: the classic guajira cycle
const BASS_FIFTH = [164.81, 110, 123.47, 110];
const voices = {
  clave(t) { tone('sine', 2450, t, 0.5, 0.07); tone('triangle', 1225, t, 0.12, 0.04); },
  campana(t, v) {
    const low = v === 3;
    const opts = { filter: 'bandpass', cutoff: low ? 900 : 1300, q: 1.2 };
    tone('square', low ? 545 : 720, t, low ? 0.22 : 0.1, low ? 0.32 : 0.1, opts);
    tone('square', low ? 815 : 1075, t, low ? 0.16 : 0.08, low ? 0.26 : 0.09, opts);
  },
  conga(t, v) {
    if (v === 3) tone('sine', 205, t, 0.6, 0.26, { to: 185 });
    else if (v === 2) { hiss(t, 0.5, 0.05, 1900, 1.4); tone('sine', 340, t, 0.2, 0.05); }
    else tone('sine', 150, t, 0.1, 0.05);
  },
  bajo(t, v, step, bar) {
    const half = ((bar * 2 + (step >= 8 ? 1 : 0)) % 4 + 4) % 4;
    const anticipates = step === 6 || step === 14;
    const f = anticipates ? BASS_ROOT[(half + 1) % 4] : BASS_FIFTH[half];
    tone('triangle', f, t, 0.55, 0.42, { filter: 'lowpass', cutoff: 700 });
    tone('sine', f / 2, t, 0.3, 0.42);
  },
  guiro(t, v) {
    if (v === 3) hiss(t, 0.16, 0.05, 3800, 2, 0.14);
    else hiss(t, 0.12, 0.035, 4200, 2, 0.01);
  },
};
function scheduleStep(step, bar, t) {
  if (bar < 0) {            // count-in: three stick clicks on 5, 6, 7
    if (step === 8 || step === 10 || step === 12) tone('square', 1700, t, 0.16, 0.03);
    return;
  }
  for (const ins of INSTRUMENTS) {
    const v = patterns[ins.id][step];
    if (v && eng.layers[ins.id]) voices[ins.id](t, v, step, bar);
  }
}
function tick() {
  const ctx = eng.ctx;
  while (eng.next < ctx.currentTime + 0.15) {
    const dur = 30 / eng.bpm;
    scheduleStep(eng.step, eng.bar, eng.next);
    eng.events.push({ time: eng.next, step: eng.step, bar: eng.bar, dur });
    eng.next += dur;
    if (++eng.step === 16) { eng.step = 0; eng.bar++; }
  }
}
// Where the music is right now, as heard: bar number and position 0..8 within the eight.
function position() {
  const ctx = eng.ctx, ev = eng.events;
  const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  while (ev.length > 1 && ev[1].time <= now) ev.shift();
  const e = ev[0];
  if (!e || e.time > now) return { bar: -1, pos: 4, step: -1 };
  const frac = clamp((now - e.time) / e.dur, 0, 1);
  return { bar: e.bar, pos: (e.step + frac) / 2, step: e.step };
}

let wakeLock = null;
async function play() {
  if (!ensureCtx()) { $('#barInfo').textContent = 'This browser cannot play audio'; return; }
  try { await eng.ctx.resume(); } catch { /* resume can be refused; scheduling still works once allowed */ }
  const now = eng.ctx.currentTime;
  eng.master.gain.cancelScheduledValues(now);
  eng.master.gain.setValueAtTime(0.85, now);
  eng.playing = true;
  eng.step = 8; eng.bar = -1; eng.events = [];
  eng.next = now + 0.1;
  learn.startBar = 0;
  caller.plan = [];
  tick();
  eng.timer = setInterval(tick, 25);
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
  updateTransport();
}
function stop() {
  if (!eng.playing) return;
  eng.playing = false;
  clearInterval(eng.timer);
  eng.master.gain.setTargetAtTime(0, eng.ctx.currentTime, 0.02);
  eng.events = [];
  manual.t = 0;
  try { if (wakeLock) wakeLock.release(); } catch { /* ignore */ }
  wakeLock = null;
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
  updateTransport();
  dirty = true;
}
function updateTransport() {
  $('#playIcon').setAttribute('d', eng.playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z');
  $('#playBtn').setAttribute('aria-label', eng.playing ? 'Pause' : 'Play');
}
function setBpm(v) {
  eng.bpm = clamp(Math.round(v), 80, 220);
  $('#bpm').value = eng.bpm;
  $('#bpmOut').textContent = eng.bpm + ' BPM';
  store.set('bpm', eng.bpm);
}

/* ---------- rueda caller ---------- */
function extendPlan() {
  const last = caller.plan[caller.plan.length - 1];
  const start = last ? last.start + last.bars : 0;
  const pool = callable.filter(m => caller.pool.has(m.id));
  if (!last || last.mv.call || !pool.length) {
    caller.plan.push({ start, bars: last ? 1 + (Math.random() < 0.5 ? 1 : 0) : 2, mv: MOVE.guapea });
    return;
  }
  let pick;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && pick.id === caller.lastPick);
  caller.lastPick = pick.id;
  caller.plan.push({ start, bars: pick.bars, mv: pick });
}
function planAt(bar, trim) {
  const plan = caller.plan;
  while (!plan.length || plan[plan.length - 1].start + plan[plan.length - 1].bars <= bar + 2) extendPlan();
  while (trim && plan.length > 1 && plan[0].start + plan[0].bars <= bar) plan.shift();
  return plan.find(e => bar >= e.start && bar < e.start + e.bars) || plan[0];
}
function speak(text) {
  if (!caller.voice) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES'; u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* speech is a bonus; the call is always shown on screen */ }
}
let callTexts = ['', ''];
function showCall(now, next, hot) {
  if (callTexts[0] !== now) { $('#callNow').textContent = now; callTexts[0] = now; }
  if (callTexts[1] !== next) {
    const el = $('#callNext');
    el.textContent = next; el.classList.toggle('hot', !!hot); callTexts[1] = next;
  }
}
function announce(p) {
  const cur = planAt(p.bar);
  const nxt = planAt(cur.start + cur.bars);
  if (nxt.mv.call && p.bar === nxt.start - 1 && p.pos >= 3.5) {
    if (!nxt.said) { nxt.said = true; speak(nxt.mv.name); }
    showCall(cur.mv.name, '¡' + nxt.mv.name + '!', true);
  } else if (cur.mv.call) {
    showCall(cur.mv.name, 'Then back to guapea.', false);
  } else {
    showCall(cur.mv.name, callable.some(m => caller.pool.has(m.id)) ? 'Listen for the call…' : 'Tick a figure below to get calls.', false);
  }
}
function setCaller(on) {
  caller.on = on;
  caller.plan = [];
  $('#callerBtn').textContent = on ? 'Stop the caller' : 'Start the caller';
  $('#callerBtn').classList.toggle('primary', !on);
  if (!on) showCall('Guapea', 'Start the caller to hear the first call.', false);
  dirty = true;
}

/* ---------- stage: computing a pose ---------- */
// Footwork. A foot travels during the half count before it lands, so it arrives on the beat.
const TRAVEL = 0.55;
function feetAt(mv, role, t) {
  const steps = stepsFor(mv, role);
  const P = { L: NEUTRAL.L.slice(), R: NEUTRAL.R.slice() };
  const lift = { L: 0, R: 0 };
  const apply = (s, pr) => {
    if (!s || pr <= 0) return;
    const from = P[s[0]], e = ease(clamp(pr, 0, 1));
    P[s[0]] = [lerp(from[0], s[1], e), lerp(from[1], s[2], e)];
    if (pr < 1) lift[s[0]] = Math.sin(Math.PI * pr);
  };
  for (let i = 0; i < 8; i++) apply(steps[i], (t - (i - TRAVEL)) / TRAVEL);
  if (t > 8 - TRAVEL) apply(steps[0], (t - (8 - TRAVEL)) / TRAVEL);   // already heading for the next 1
  const s = steps[Math.floor(t) % 8];
  return { P, lift, landed: s && t - Math.floor(t) < 0.45 ? s[0] : '' };
}
// Partner figures. Linear between count keyframes; angles take the shortest way round.
const angLerp = (a, b, f) => a + ((((b - a) % 360) + 540) % 360 - 180) * f;
const mix = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), angLerp(a[2], b[2], f)];
function bodyAt(mv, t) {
  const kf = mv.kf, N = kf.length;
  let a, b, f, alpha = 1;
  if (mv.loop) {
    const i = Math.floor(t) % N;
    a = kf[i]; b = kf[(i + 1) % N]; f = t - Math.floor(t);
  } else {
    // A figure that ends somewhere new: hold the ending, fade, and reset to the start.
    let tt = t;
    if (t >= N - 0.5) { tt = t - N; alpha = clamp((tt + 0.5) / 0.3, 0, 1); }
    else if (t > N - 0.85) alpha = clamp((N - 0.5 - t) / 0.3, 0, 1);
    if (tt < 0) { a = mv.start; b = kf[0]; f = (tt + 0.5) / 0.5; }
    else { const i = Math.min(Math.floor(tt), N - 1); a = kf[i]; b = kf[Math.min(i + 1, N - 1)]; f = tt - i; }
  }
  f = clamp(f, 0, 1);
  return { L: mix(a.L, b.L, f), F: mix(a.F, b.F, f), hold: a.hold, alpha };
}

/* ---------- stage: drawing ---------- */
const footEls = { L: $('#footL'), R: $('#footR') };
$$('.foot').forEach(p => p.setAttribute('d', FOOT_PATH));
const feetLayer = $('#feetLayer'), bodyLayer = $('#bodyLayer');
const dancerEls = { L: $('#dancerL'), F: $('#dancerF') }, lblEls = { L: $('#lblL'), F: $('#lblF') };
const armEls = [$('#arm1'), $('#arm2')];
const SHOULDER = 6.2;

function setupStage(mv) {
  const feet = mv.view === 'feet';
  feetLayer.style.display = feet ? '' : 'none';
  bodyLayer.style.display = feet ? 'none' : '';
  $('#legend').hidden = feet;
  $('#capName').textContent = mv.name;
  if (feet) {
    feetLayer.setAttribute('class', state.role === 'leader' ? 'as-leader' : 'as-follower');
    const spots = new Map();
    stepsFor(mv, state.role).forEach((s, i) => {
      if (!s) return;
      const key = s.join(',');
      if (!spots.has(key)) spots.set(key, { foot: s[0], x: s[1], y: s[2], counts: [] });
      spots.get(key).counts.push(i + 1);
    });
    const g = $('#ghosts');
    g.replaceChildren();
    for (const sp of spots.values()) {
      const left = sp.foot === 'L';
      g.append(svgEl('path', { d: FOOT_PATH, class: 'ghost', transform: `translate(${sp.x} ${sp.y})` }));
      g.append(svgEl('text', { x: sp.x + (left ? -5.4 : 5.4), y: sp.y + 1.4, 'text-anchor': left ? 'end' : 'start', class: 'ghost-n' }, sp.counts.join('·')));
    }
  } else {
    const pts = who => [...(mv.start ? [mv.start] : []), ...mv.kf, ...(mv.loop ? [mv.kf[0]] : [])].map(q => q[who][0] + ',' + q[who][1]).join(' ');
    $('#trailL').setAttribute('points', pts('L'));
    $('#trailF').setAttribute('points', pts('F'));
    dancerEls.L.classList.toggle('you', state.role === 'leader');
    dancerEls.F.classList.toggle('you', state.role === 'follower');
  }
}
function drawFeet(mv, t) {
  const st = feetAt(mv, state.role, t);
  for (const f of ['L', 'R']) {
    const [x, y] = st.P[f];
    footEls[f].setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(1 + 0.16 * st.lift[f]).toFixed(3)})`);
    footEls[f].classList.toggle('landed', st.landed === f);
  }
}
const shoulder = (d, side) => {
  const r = d[2] * Math.PI / 180;
  return [d[0] + side * SHOULDER * Math.cos(r), d[1] + side * SHOULDER * Math.sin(r)];
};
function setArm(el, from, to) {
  if (!from) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.setAttribute('x1', from[0].toFixed(2)); el.setAttribute('y1', from[1].toFixed(2));
  el.setAttribute('x2', to[0].toFixed(2)); el.setAttribute('y2', to[1].toFixed(2));
}
function drawBodies(mv, t) {
  const p = bodyAt(mv, t);
  for (const w of ['L', 'F']) {
    const d = p[w];
    dancerEls[w].setAttribute('transform', `translate(${d[0].toFixed(2)} ${d[1].toFixed(2)}) rotate(${d[2].toFixed(1)})`);
    lblEls[w].setAttribute('x', d[0].toFixed(2));
    lblEls[w].setAttribute('y', (d[1] + 1.2).toFixed(2));
  }
  // Leader's left hand to follower's right hand is the standard connection.
  const h = p.hold;
  setArm(armEls[0], h === 'none' ? null : shoulder(p.L, -1), shoulder(p.F, 1));
  if (h === 'closed') setArm(armEls[1], shoulder(p.L, 1), [p.F[0], p.F[1]]);
  else if (h === 'double') setArm(armEls[1], shoulder(p.L, 1), shoulder(p.F, -1));
  else setArm(armEls[1], null);
  bodyLayer.style.opacity = p.alpha.toFixed(2);
}

/* ---------- the frame loop ---------- */
let dirty = true, stageKey = '', lastCount = -2, lastSeg = -2, lastInfo = '', lastCol = -2;
const countEls = [];

function current() {
  if (!eng.playing) {
    const mv = caller.on ? MOVE.guapea : selected();
    if (manual.t >= mv.bars * 8) manual.t = 0;
    return { mv, t: manual.t, count: manual.t % 8, step: -1, paused: true };
  }
  const p = position();
  if (p.bar < 0) {
    const mv = caller.on ? MOVE.guapea : selected(), N = mv.bars * 8, f = clamp(p.pos - 7, 0, 1);
    const t = mv.loop ? N - 1 + f * 0.999 : N - 0.2 + f * 0.199;
    return { mv, t, count: Math.floor(p.pos) % 8, step: p.step, countIn: true };
  }
  let mv, t;
  if (caller.on) {
    const e = planAt(p.bar, true);
    mv = e.mv; t = (p.bar - e.start) * 8 + p.pos;
    announce(p);
  } else {
    mv = selected();
    const b = (((p.bar - learn.startBar) % mv.bars) + mv.bars) % mv.bars;
    t = b * 8 + p.pos;
  }
  return { mv, t: Math.min(t, mv.bars * 8 - 1e-4), count: Math.floor(p.pos) % 8, step: p.step };
}
function draw(c) {
  const key = c.mv.id + '|' + state.role;
  if (key !== stageKey) { setupStage(c.mv); stageKey = key; }
  if (c.mv.view === 'feet') drawFeet(c.mv, c.t); else drawBodies(c.mv, c.t);

  if (c.count !== lastCount) {
    countEls.forEach((el, i) => el.classList.toggle('on', i === c.count));
    lastCount = c.count;
  }
  const eight = Math.floor(c.t / 8) + 1;
  const info = c.countIn ? 'Count-in: 5, 6, 7…'
    : c.mv.bars > 1 ? `Eight ${eight} of ${c.mv.bars}`
    : c.paused ? 'Step through with the arrows' : 'One eight, looping';
  if (info !== lastInfo) {
    $('#barInfo').textContent = info;
    $('#capInfo').textContent = (c.mv.view === 'feet' ? 'Your feet, seen from above' : 'Both dancers, seen from above')
      + (c.mv.bars > 1 ? ` · eight ${eight} of ${c.mv.bars}` : '');
    lastInfo = info;
  }
  const seg = c.mv.id === state.moveId && !c.countIn ? Math.floor(c.t / 4) : -1;
  if (seg !== lastSeg) {
    $$('#moveDetail .breakdown li').forEach((li, i) => li.classList.toggle('on', i === seg));
    lastSeg = seg;
  }
  if (c.step !== lastCol) {
    $$('#grid col.step').forEach((col, i) => col.classList.toggle('on', i === c.step));
    lastCol = c.step;
  }
}
function frame() {
  requestAnimationFrame(frame);
  if (!eng.playing && !dirty) return;
  dirty = false;
  draw(current());
}

/* ---------- moves tab ---------- */
function renderList() {
  const root = $('#moveList');
  root.replaceChildren();
  for (const lv of LEVELS) {
    const sec = document.createElement('div');
    sec.className = 'level';
    sec.innerHTML = `<div class="eyebrow">${lv.title}</div><div class="chips"></div>`;
    for (const mv of MOVES.filter(m => m.level === lv.n)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.move = mv.id;
      b.setAttribute('aria-pressed', String(mv.id === state.moveId));
      b.innerHTML = mv.name + (state.learned.has(mv.id) ? '<span class="tick" aria-label="learned">✓</span>' : '');
      sec.lastElementChild.append(b);
    }
    root.append(sec);
  }
  const n = state.learned.size;
  $('#progText').textContent = `${n} of ${MOVES.length} learned`;
  $('#progFill').style.width = (100 * n / MOVES.length) + '%';
}
function renderDetail() {
  const mv = selected(), role = state.role, other = role === 'leader' ? 'follower' : 'leader';
  const me = role === 'leader' ? 'L' : 'F', them = role === 'leader' ? 'F' : 'L';
  const rows = mv.rows.map((r, i) => {
    const text = r.B ? `<p>${r.B}</p>`
      : `<p><span class="who ${role}">You</span>${r[me]}</p>` + (mv.solo ? '' : `<p class="partner"><span class="who ${other}">Partner</span>${r[them]}</p>`);
    const eight = mv.bars > 1 ? `<small>Eight ${Math.floor(i / 2) + 1}</small>` : '';
    return `<li><div class="seg-n">${r.c}${eight}</div><div class="seg-t">${text}</div></li>`;
  }).join('');
  const idx = MOVES.indexOf(mv), next = MOVES[idx + 1];
  const done = state.learned.has(mv.id);
  $('#moveDetail').innerHTML = `
    <div>
      <p class="eyebrow">${mv.view === 'feet' ? 'Footwork' : 'Partner figure'} · ${mv.bars * 8} counts · as ${role}</p>
      <h2>${mv.name} <span class="gloss">${mv.gloss}</span></h2>
    </div>
    <p class="prose">${mv.lede}</p>
    <ol class="breakdown">${rows}</ol>
    <h3>Watch for</h3>
    <ul class="tips">${mv.tips.map(t => `<li>${t}</li>`).join('')}</ul>
    <div class="actions">
      <button type="button" class="btn ${done ? 'done' : 'primary'}" id="learnBtn" aria-pressed="${done}">${done ? '✓ Learned' : 'Mark as learned'}</button>
      ${next ? `<button type="button" class="btn" id="nextMoveBtn">Next: ${next.name}</button>` : ''}
    </div>`;
  lastSeg = -2;
}
function selectMove(id) {
  if (!MOVE[id]) return;
  if (caller.on) setCaller(false);
  state.moveId = id;
  store.set('move', id);
  manual.t = 0;
  if (eng.playing) learn.startBar = position().bar;
  renderList(); renderDetail();
  dirty = true;
}
function setRole(role) {
  state.role = role;
  store.set('role', role);
  $$('.role button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
  renderDetail();
  dirty = true;
}

/* ---------- rhythm tab ---------- */
function renderGrid() {
  const dots = v => v ? `<span class="dot d${v}"></span>` : '';
  let head = '<th scope="col"><span class="eyebrow">Count</span></th>';
  for (let i = 0; i < 16; i++) {
    const n = i / 2 + 1;
    head += i % 2 ? '<th class="and" scope="col">&amp;</th>' : `<th scope="col"${n === 4 || n === 8 ? ' class="rest"' : ''}>${n}</th>`;
  }
  const body = INSTRUMENTS.map(ins => {
    const on = eng.layers[ins.id];
    const cells = patterns[ins.id].map((v, i) => `<td${i % 2 ? '' : ' class="beat"'}>${dots(v)}</td>`).join('');
    return `<tr class="${on ? '' : 'off'}"><th scope="row"><button type="button" class="layer" data-layer="${ins.id}" aria-pressed="${on}">${ins.name}</button></th>${cells}</tr>`;
  }).join('');
  $('#grid').innerHTML = `<colgroup><col>${'<col class="step">'.repeat(16)}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  lastCol = -2;
  $$('#claveSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.clave === eng.clave)));
}
let streak = 0;
function tap() {
  const out = $('#tapResult');
  if (!eng.playing) { out.textContent = 'Press play first, then tap on every 1.'; return; }
  const p = position();
  if (p.bar < 0) { out.textContent = 'That was the count-in. The 1 comes next.'; return; }
  const nearest = Math.round(p.pos);
  const off = (p.pos - nearest) * (60 / eng.bpm) * 1000;
  const count = (nearest % 8) + 1;
  const timing = Math.abs(off) < 15 ? 'dead on' : `${Math.round(Math.abs(off))} ms ${off < 0 ? 'early' : 'late'}`;
  if (count === 1 && Math.abs(off) <= 120) {
    streak++;
    out.textContent = `On the 1, ${timing}. ${streak} in a row.`;
  } else {
    streak = 0;
    out.textContent = count === 1 ? `Count 1, but ${timing}. Try again.`
      : count === 5 ? `That was count 5, the other strong step. Listen for where the phrase begins.`
      : `That was count ${count}. Wait for the two open conga tones, then step.`;
  }
}
function syncBlind() {
  const onRhythm = !$('#view-rhythm').hidden;
  document.body.classList.toggle('blind', onRhythm && eng.playing && $('#blindChk').checked && tapArmed);
}
let tapArmed = false;

/* ---------- rueda tab ---------- */
function renderPool() {
  $('#poolList').innerHTML = callable.map(m =>
    `<label class="check"><input type="checkbox" id="pool-${m.id}" data-pool="${m.id}"${caller.pool.has(m.id) ? ' checked' : ''}> ${m.name}</label>`).join('');
  $('#voiceChk').checked = !!caller.voice;
}

/* ---------- routing between the three views ---------- */
const VIEWS = ['moves', 'rhythm', 'rueda'];
function route() {
  const h = location.hash.slice(1), v = VIEWS.includes(h) ? h : 'moves';
  for (const n of VIEWS) $('#view-' + n).hidden = n !== v;
  $$('.tabs a').forEach(a => {
    if (a.getAttribute('href') === '#' + v) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (v !== 'rhythm') tapArmed = false;
  syncBlind();
}

/* ---------- wiring ---------- */
function init() {
  const counts = $('#counts');
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'count' + (i === 3 || i === 7 ? ' rest' : '');
    b.textContent = i + 1;
    b.setAttribute('aria-label', `Count ${i + 1}` + (i === 3 || i === 7 ? ', pause' : ''));
    b.addEventListener('click', () => {
      stop();
      manual.t = Math.floor(manual.t / 8) * 8 + i;
      dirty = true;
    });
    counts.append(b);
    countEls.push(b);
  }
  $('#playBtn').addEventListener('click', () => { if (eng.playing) stop(); else play(); syncBlind(); });
  const stepBy = d => {
    stop();
    const N = (caller.on ? MOVE.guapea : selected()).bars * 8;
    manual.t = (manual.t + d + N) % N;
    dirty = true;
    syncBlind();
  };
  $('#prevBtn').addEventListener('click', () => stepBy(-1));
  $('#nextBtn').addEventListener('click', () => stepBy(1));
  $('#bpm').addEventListener('input', e => setBpm(+e.target.value));
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-bpm]'); if (b) setBpm(+b.dataset.bpm); });
  $$('.role button').forEach(b => b.addEventListener('click', () => setRole(b.dataset.role)));

  $('#moveList').addEventListener('click', e => { const b = e.target.closest('[data-move]'); if (b) selectMove(b.dataset.move); });
  $('#moveDetail').addEventListener('click', e => {
    if (e.target.closest('#learnBtn')) {
      const id = state.moveId;
      if (state.learned.has(id)) state.learned.delete(id); else state.learned.add(id);
      store.set('learned', [...state.learned]);
      renderList(); renderDetail(); dirty = true;
    } else if (e.target.closest('#nextMoveBtn')) {
      selectMove(MOVES[MOVES.indexOf(selected()) + 1].id);
    }
  });

  $('#grid').addEventListener('click', e => {
    const b = e.target.closest('[data-layer]');
    if (!b) return;
    eng.layers[b.dataset.layer] = !eng.layers[b.dataset.layer];
    store.set('layers', eng.layers);
    renderGrid(); dirty = true;
  });
  $('#claveSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-clave]');
    if (!b) return;
    eng.clave = b.dataset.clave;
    store.set('clave', eng.clave);
    refreshPatterns(); renderGrid(); dirty = true;
  });
  $('#tapBtn').addEventListener('pointerdown', e => { e.preventDefault(); tapArmed = true; tap(); syncBlind(); });
  $('#tapBtn').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapArmed = true; tap(); syncBlind(); } });
  $('#blindChk').addEventListener('change', syncBlind);

  $('#callerBtn').addEventListener('click', () => {
    if (caller.on) { setCaller(false); stop(); return; }
    setCaller(true);
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch { /* voice is optional */ }
    stop();
    play();
  });
  $('#voiceChk').addEventListener('change', e => { caller.voice = e.target.checked; store.set('voice', caller.voice); });
  $('#poolList').addEventListener('change', e => {
    const id = e.target.dataset.pool;
    if (!id) return;
    if (e.target.checked) caller.pool.add(id); else caller.pool.delete(id);
    store.set('pool', [...caller.pool]);
  });

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, button, a, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); if (eng.playing) stop(); else play(); syncBlind(); }
    else if (e.key === 'ArrowRight') stepBy(1);
    else if (e.key === 'ArrowLeft') stepBy(-1);
  });
  window.addEventListener('hashchange', route);

  setBpm(eng.bpm);
  $$('.role button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === state.role)));
  renderList(); renderDetail(); renderGrid(); renderPool();
  route();
  requestAnimationFrame(frame);
}
init();
})();
