/* =====================================================
   TalaDeck — app.js
   Rewritten with: classes, constructors, arrays, object literals
   (index.html and style.css stay exactly the same)
   ===================================================== */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* =====================================================
   1. OBJECT LITERALS  (plain data + helper objects)
   ===================================================== */

// Page names for the breadcrumb
const PAGE_NAMES = {
  home: 'Home',
  flashcards: 'My Flashcards',
  notes: 'My Notes',
  study: 'Study & Review',
  profile: 'My Profile',
  settings: 'Settings'
};

// Motivational messages, grouped in arrays inside an object literal
const MOTIVE = {
  hi: [
    'Outstanding! Your hard work is showing.',
    'You really know this one. Keep that momentum going!',
    'Excellent recall. Be proud of how far you’ve come.',
    'Brilliant! Consistency like this builds real mastery.',
    'Look at you go! Challenge yourself with a bigger deck next.'
  ],
  mid: [
    'Great job! A little more practice and it’ll be second nature.',
    'You’re getting there. Every review makes it stick a bit more.',
    'Solid effort. The cards you missed are the ones that will help you grow.',
    'Nice progress! One more round and you’ll feel the difference.',
    'You’re closer than you think. Keep showing up!'
  ],
  lo: [
    'Every expert started right where you are. Keep going!',
    'Mistakes are how learning happens. Try another round when you’re ready.',
    'You showed up, and that’s what counts. Take a breath and go again.',
    'Don’t be discouraged. Your brain is building new connections right now.',
    'Small steps still move you forward. You’ve got this!'
  ]
};

// An object literal with a property (last) and a method (pick)
const Motivator = {
  last: '',
  pick(accuracy) {
    const level = accuracy >= 80 ? 'hi' : accuracy >= 50 ? 'mid' : 'lo';
    const choices = MOTIVE[level].filter(m => m !== this.last);
    this.last = choices[Math.floor(Math.random() * choices.length)];
    return this.last;
  }
};

// Small helper functions grouped in one object literal
const Util = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
  today() {
    return new Date().toLocaleDateString('en-CA');
  },
  yesterday() {
    return new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
  },
  esc(t) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return String(t).replace(/[&<>"]/g, c => map[c]);
  },
  // lowercase, remove accents + punctuation so answers compare fairly
  norm(t) {
    return t.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  },
  // Levenshtein distance = how many edits between two strings
  distance(a, b) {
    const row = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const temp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = temp;
      }
    }
    return row[b.length];
  },
  // right if equal, or (for longer answers) only 1 typo away
  isRight(answer, key) {
    answer = this.norm(answer);
    key = this.norm(key);
    return answer === key || (key.length > 5 && answer.length > 0 && this.distance(answer, key) <= 1);
  },
  // Fisher-Yates shuffle (returns a new array)
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
};
const esc = Util.esc;   // short names used inside the HTML templates
const norm = Util.norm;

/* =====================================================
   2. CLASSES  (each has a constructor)
   ===================================================== */

// ---- One flashcard: front (q), back (a), optional choices (ch) ----
class Card {
  constructor(q, a, ch = null) {
    this.q = q;
    this.a = a;
    this.ch = ch;           // array of choices, or null
  }
  static fromObject(o) {    // turn saved plain data back into a Card
    return new Card(o.q, o.a, o.ch || null);
  }
  copy() {
    return new Card(this.q, this.a, this.ch ? [...this.ch] : null);
  }
  hasChoices() {
    return Array.isArray(this.ch) && this.ch.length >= 4;
  }
  isCorrect(text) {
    return Util.isRight(text, this.a);
  }
}

// ---- A deck holds an array of Card objects ----
class Deck {
  constructor(title, cards = [], id = Util.uid(), at = Date.now(), pin = false) {
    this.id = id;
    this.title = title;
    this.cards = cards;     // array of Card
    this.at = at;
    this.pin = pin;
  }
  static fromObject(o) {
    return new Deck(o.title, (o.cards || []).map(c => Card.fromObject(c)), o.id, o.at, !!o.pin);
  }
  cardCount() {
    return this.cards.length;
  }
  matches(query) {
    const text = this.title + ' ' + this.cards.map(c => c.q + ' ' + c.a).join(' ');
    return text.toLowerCase().includes(query);
  }
  preview() {
    return this.cards.slice(0, 3).map(c => c.q).join('\n');
  }
}

// ---- A note ----
class Note {
  constructor(title, body, id = Util.uid(), at = Date.now()) {
    this.id = id;
    this.title = title;
    this.body = body;
    this.at = at;
  }
  static fromObject(o) {
    return new Note(o.title, o.body, o.id, o.at);
  }
  matches(query) {
    return (this.title + this.body).toLowerCase().includes(query);
  }
}

// ---- Store: keeps ALL app data and saves it to the browser ----
class Store {
  constructor(key) {
    this.key = key;
    this.user = null;
    this.decks = [];        // array of Deck
    this.notes = [];        // array of Note
    this.sessions = 0;
    this.bestStreak = 0;
    this.dark = false;
    this.streak = 0;
    this.last = '';
    this.today = { d: '', n: 0 };
    this.goal = 20;
    this.sample = false;

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    if (saved) this.load(saved);
  }
  // Copy data (from storage or a backup file) into this object
  load(data) {
    const simple = ['user', 'sessions', 'bestStreak', 'dark', 'streak', 'last', 'today', 'goal', 'sample'];
    for (const field of simple) {
      if (data[field] !== undefined) this[field] = data[field];
    }
    if (Array.isArray(data.decks)) this.decks = data.decks.map(d => Deck.fromObject(d));
    if (Array.isArray(data.notes)) this.notes = data.notes.map(n => Note.fromObject(n));
  }
  // JSON.stringify(store) calls this to decide what gets saved
  toJSON() {
    return {
      user: this.user, decks: this.decks, notes: this.notes,
      sessions: this.sessions, bestStreak: this.bestStreak, dark: this.dark,
      streak: this.streak, last: this.last, today: this.today,
      goal: this.goal, sample: this.sample
    };
  }
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this)); } catch (e) {}
  }
  findDeck(id) { return this.decks.find(d => d.id === id); }
  findNote(id) { return this.notes.find(n => n.id === id); }

  userInfo() {
    return this.user || { name: 'Student', user: 'student' };
  }
  cardsToday() {
    return this.today && this.today.d === Util.today() ? this.today.n : 0;
  }
  currentStreak() {
    return (this.last === Util.today() || this.last === Util.yesterday()) ? this.streak : 0;
  }
  // called every time a card is answered correctly
  bump() {
    const d = Util.today();
    if (!this.today || this.today.d !== d) this.today = { d, n: 0 };
    this.today.n++;
    if (this.last !== d) {
      this.streak = this.last === Util.yesterday() ? (this.streak || 0) + 1 : 1;
      this.last = d;
    }
    this.save();
  }
  recordSession(bestInRound) {
    this.sessions++;
    this.bestStreak = Math.max(this.bestStreak || 0, bestInRound);
    this.save();
  }
}

// ---- StudyRound: one play-through of a deck ----
class StudyRound {
  constructor(deck, mode, cards) {
    this.deck = deck;
    this.mode = (mode === 'choice' && deck.cardCount() < 2) ? 'type' : mode;
    this.queue = Util.shuffle(cards.map(c => c.copy()));   // array of Card
    this.total = cards.length;
    this.done = 0;
    this.streak = 0;
    this.best = 0;
    this.hit = 0;
    this.miss = 0;
    this.retype = false;
    this.missedCards = [];   // array of Card
    this.opts = null;
    this.flipped = false;
  }
  current() { return this.queue[0]; }
  isFinished() { return this.queue.length === 0; }
  progress() { return this.done / this.total * 100; }
  accuracy() { return Math.round(this.hit / Math.max(1, this.hit + this.miss) * 100); }
  hasMissed(card) { return this.missedCards.includes(card); }

  recordHit() {
    this.streak++;
    this.best = Math.max(this.best, this.streak);
    if (!this.hasMissed(this.current())) this.hit++;
  }
  recordMiss() {
    this.streak = 0;
    const c = this.current();
    if (!this.hasMissed(c)) {
      this.miss++;
      this.missedCards.push(c);
    }
  }
  advance() {
    this.queue.shift();
    this.done++;
    this.opts = null;
    this.flipped = false;
  }
  // choices for multiple-choice mode (made once per card)
  options() {
    if (this.opts) return this.opts;
    const c = this.current();
    if (c.hasChoices()) {
      this.opts = Util.shuffle(c.ch);
    } else {
      const others = this.deck.cards.map(x => x.a).filter(a => norm(a) !== norm(c.a));
      this.opts = Util.shuffle([c.a, ...Util.shuffle(others).slice(0, 3)]);
    }
    return this.opts;
  }
}

// ---- DeckEditor: the "new deck / edit deck" pop-up ----
class DeckEditor {
  constructor(deck) {
    this.deck = deck || null;                              // null = brand new deck
    this.cards = deck ? deck.cards.map(c => c.copy()) : []; // working copy (array of Card)
    this.editIndex = -1;                                   // which card is being edited
    this.choices = DeckEditor.blankChoices();
    this.form = null;
  }
  static blankChoices() { return ['', '', '', '']; }

  open() {
    const d = this.deck;
    modal(d ? 'Edit deck' : 'New deck', `<form class="form" id="deckEd"><label>Deck title<input name="t" required maxlength="60" value="${d ? esc(d.title) : ''}"></label><div class="cardbox"><b>Add a card</b><label>Front — your note or question<textarea name="q" rows="2" placeholder="e.g. Capital of France"></textarea></label><label>Back — the answer<textarea name="a" rows="2" placeholder="e.g. Paris"></textarea></label><fieldset class="chs"><legend>Choices — at least 4, include the correct answer</legend><div id="chBox"></div><button type="button" class="outline" id="addCh">＋ Add choice</button></fieldset><button type="button" class="outline" id="addCard">＋ Add card</button><small>Tip: press Enter in the Back box to add the card, then type the next one.</small><details><summary>Paste many cards at once</summary><textarea name="bulk" rows="4" placeholder="Capital of France | Paris&#10;2 + 2 | 4"></textarea><button type="button" class="outline" id="bulkBtn">Import pasted cards</button></details></div><div id="cardList"></div><button class="primary">Save deck</button></form>`,
      form => this.save(form));
    this.form = $('#deckEd');
    this.wireEvents();
    this.drawChoices();
    this.drawCards();
  }

  save(form) {
    if ((form.q.value.trim() || form.a.value.trim()) && !this.addCard()) return;
    if (!this.cards.length) return toast('Add at least one card first');
    if (this.deck) {
      this.deck.title = form.t.value.trim();
      this.deck.cards = this.cards;
    } else {
      store.decks.unshift(new Deck(form.t.value.trim(), this.cards));
    }
    store.save();
    closeModal();
    render();
    toast('Deck saved');
  }

  drawChoices() {
    $('#chBox').innerHTML = this.choices.map((v, i) =>
      `<div class="row2" style="margin:4px 0"><input class="chi" data-ci="${i}" placeholder="Choice ${i + 1}" value="${esc(v)}" style="flex:1">${i > 3 ? `<button type="button" class="icon" data-cx="${i}" aria-label="Remove choice">×</button>` : ''}</div>`
    ).join('');
  }

  drawCards() {
    const n = this.cards.length;
    $('#cardList').innerHTML = `<small>${n} card${n === 1 ? '' : 's'} in this deck</small>` +
      this.cards.map((c, i) =>
        `<div class="citem"><span><b>${esc(c.q)}</b><br><small>${esc(c.a)}${c.ch ? ' · ' + c.ch.length + ' choices' : ' · no custom choices'}</small></span><span class="row2" style="margin:0"><button type="button" class="outline" data-ed="${i}">Edit</button><button type="button" class="icon" data-rm="${i}" aria-label="Remove card">×</button></span></div>`
      ).join('');
  }

  resetCardFields() {
    this.editIndex = -1;
    this.choices = DeckEditor.blankChoices();
    this.drawChoices();
    this.form.q.value = this.form.a.value = '';
    $('#addCard').textContent = '＋ Add card';
  }

  // validates the fields, then adds (or updates) a card. Returns true if it worked.
  addCard() {
    const f = this.form;
    const q = f.q.value.trim(), a = f.a.value.trim();
    if (!q || !a) { toast('Fill in both the front and the back'); return false; }
    const cs = this.choices.map(x => x.trim()).filter(Boolean);
    if (cs.length < 4) { toast('Add at least 4 choices'); return false; }
    if (new Set(cs.map(norm)).size < cs.length) { toast('Choices must all be different'); return false; }
    if (!cs.some(x => norm(x) === norm(a))) { toast('One of the choices must be the correct answer'); return false; }

    const card = new Card(q, a, cs);
    const wasEditing = this.editIndex >= 0;
    if (wasEditing) this.cards[this.editIndex] = card;
    else this.cards.push(card);

    this.resetCardFields();
    this.drawCards();
    f.q.focus();
    toast(wasEditing ? 'Card updated' : 'Card added');
    return true;
  }

  // "question | answer" on each line
  importBulk() {
    const f = this.form;
    const made = f.bulk.value.split('\n').map(line => {
      const i = line.indexOf('|');
      return i < 0 ? null : new Card(line.slice(0, i).trim(), line.slice(i + 1).trim());
    }).filter(c => c && c.q && c.a);
    if (!made.length) return toast('Use one card per line: question | answer');
    this.cards.push(...made);
    f.bulk.value = '';
    this.drawCards();
    toast(made.length + ' cards imported');
  }

  wireEvents() {
    const f = this.form;
    $('#addCard').onclick = () => this.addCard();
    $('#bulkBtn').onclick = () => this.importBulk();

    $('#cardList').onclick = e => {
      const rm = e.target.closest('[data-rm]');
      const ed = e.target.closest('[data-ed]');
      if (rm) {
        this.cards.splice(+rm.dataset.rm, 1);
        if (this.editIndex >= 0) this.resetCardFields();
        this.drawCards();
      }
      if (ed) {
        this.editIndex = +ed.dataset.ed;
        const c = this.cards[this.editIndex];
        f.q.value = c.q;
        f.a.value = c.a;
        this.choices = [...(c.ch || [])];
        while (this.choices.length < 4) this.choices.push('');
        this.drawChoices();
        $('#addCard').textContent = '✓ Update card';
        f.q.focus();
      }
    };

    f.t.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); f.q.focus(); } };
    f.a.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.addCard(); } };

    $('#addCh').onclick = () => {
      if (this.choices.length >= 8) return toast('Up to 8 choices');
      this.choices.push('');
      this.drawChoices();
      $('#chBox').querySelector('[data-ci="' + (this.choices.length - 1) + '"]').focus();
    };
    $('#chBox').oninput = e => {
      if (e.target.dataset.ci) this.choices[+e.target.dataset.ci] = e.target.value;
    };
    $('#chBox').onclick = e => {
      const x = e.target.closest('[data-cx]');
      if (x) { this.choices.splice(+x.dataset.cx, 1); this.drawChoices(); }
    };
    $('#chBox').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = e.target.closest('.row2').nextElementSibling;
        if (next) next.querySelector('input').focus();
      }
    };
    // when you leave the Back box, copy the answer into the first empty choice
    f.a.addEventListener('blur', () => {
      const a = f.a.value.trim();
      if (a && !this.choices.some(x => norm(x) === norm(a))) {
        const i = this.choices.findIndex(x => !x.trim());
        if (i >= 0) { this.choices[i] = a; this.drawChoices(); }
      }
    });
  }
}

/* =====================================================
   3. APP STATE  (objects made from the classes above)
   ===================================================== */
const store = new Store('taladeck.v2');
let round = null;                       // the current StudyRound (or null)
let mode = 'type';                      // 'type' | 'choice' | 'flip'
let lastMissed = { id: '', cards: [] }; // object literal: cards to retry

/* =====================================================
   4. UI HELPERS
   ===================================================== */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function undoToast(msg, undoFn) {
  const t = $('#toast');
  const hide = () => { t.classList.remove('show'); t.style.pointerEvents = ''; t.onclick = null; };
  t.textContent = msg + ' — tap to undo';
  t.style.pointerEvents = 'auto';
  t.classList.add('show');
  t.onclick = () => { undoFn(); hide(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, 5000);
}

function go(page) {
  $$('.page').forEach(e => e.classList.toggle('active', e.id === 'page-' + page));
  $$('.sidebar .nav').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#crumb').textContent = PAGE_NAMES[page];
  $('#sidebar').classList.remove('open');
  render();
}

function modal(title, html, onSubmit) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalBackdrop').classList.remove('hidden');
  const f = $('#modalBody form');
  if (f) {
    f.onsubmit = e => { e.preventDefault(); onSubmit(f); };
    f.querySelector('input,textarea').focus();
  }
}
const closeModal = () => $('#modalBackdrop').classList.add('hidden');

function noteForm(n) {
  modal(n ? 'Edit note' : 'New note',
    `<form class="form"><label>Title<input name="t" required maxlength="80" value="${n ? esc(n.title) : ''}"></label><label>Content<textarea name="c" rows="8" required>${n ? esc(n.body) : ''}</textarea></label><button class="primary">Save note</button></form>`,
    f => {
      if (n) {
        n.title = f.t.value.trim();
        n.body = f.c.value;
      } else {
        store.notes.unshift(new Note(f.t.value.trim(), f.c.value));
      }
      store.save();
      closeModal();
      render();
      toast('Note saved');
    });
}

/* =====================================================
   5. RENDERING THE PAGES
   ===================================================== */
const deckCardHTML = d =>
  `<article class="card"><h3>${esc(d.title)}</h3><small>${d.cardCount()} cards</small><p>${esc(d.preview())}</p><div class="row"><button class="primary" data-study="${d.id}">Study</button><button class="outline" data-pin="${d.id}" aria-label="Pin deck">${d.pin ? '★' : '☆'}</button><button class="outline" data-edit-deck="${d.id}">Edit</button><button class="outline danger" data-del-deck="${d.id}">Delete</button></div></article>`;

const noteCardHTML = n =>
  `<article class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="row"><button class="outline" data-edit-note="${n.id}">Edit</button><button class="outline danger" data-del-note="${n.id}">Delete</button></div></article>`;

function render() {
  // --- profile bits ---
  const u = store.userInfo();
  const initial = u.name[0].toUpperCase();
  ['sideAvatar', 'topAvatar', 'profileAvatar'].forEach(id => $('#' + id).textContent = initial);
  $('#sideName').textContent = $('#topName').textContent = $('#profileHeading').textContent = u.name;
  $('#sideHandle').textContent = '@' + u.user;
  $('#greeting').textContent = 'Hello, ' + u.name + '!';
  $('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // --- home stats ---
  $('#deckCount').textContent = store.decks.length;
  $('#noteCount').textContent = store.notes.length;
  $('#sessionCount').textContent = store.sessions;
  $('#bestStreak').textContent = store.bestStreak;

  const n = store.cardsToday();
  const streak = store.currentStreak();
  $('#goalTxt').textContent = Math.min(n, store.goal) + ' / ' + store.goal + ' cards today';
  $('#goalBar').style.width = Math.min(100, n / store.goal * 100) + '%';
  $('#dayStreak').textContent = streak ? '🔥 ' + streak + '-day study streak' : 'Study today to start a streak';

  $('#recentDecks').innerHTML = store.decks.slice(0, 3).map(d =>
    `<button class="recent" data-study="${d.id}"><span style="flex:1"><b>${esc(d.title)}</b><br><small>${d.cardCount()} cards</small></span>Study</button>`
  ).join('') || '<div class="empty">No decks yet. Create your first one.</div>';

  // --- decks page (search + pinned first) ---
  const dq = $('#deckSearch').value.toLowerCase();
  const shownDecks = store.decks.filter(d => d.matches(dq)).sort((a, b) => !!b.pin - !!a.pin);
  $('#deckCountLabel').textContent = shownDecks.length + ' deck' + (shownDecks.length === 1 ? '' : 's');
  $('#deckGrid').innerHTML = shownDecks.map(deckCardHTML).join('') || '<div class="empty">No decks found.</div>';

  // --- notes page ---
  const nq = $('#noteSearch').value.toLowerCase();
  const shownNotes = store.notes.filter(note => note.matches(nq));
  $('#noteCountLabel').textContent = shownNotes.length + ' note' + (shownNotes.length === 1 ? '' : 's');
  $('#noteGrid').innerHTML = shownNotes.map(noteCardHTML).join('') || '<div class="empty">No notes found.</div>';

  // --- study page deck list ---
  $('#studyChoices').innerHTML = store.decks.map(d =>
    `<button class="choice" data-study="${d.id}"><b>${esc(d.title)}</b><small>${d.cardCount()} cards</small></button>`
  ).join('') || '<div class="empty">Create a deck first.</div>';

  // --- dark mode ---
  $('#dark').checked = store.dark;
  document.body.classList.toggle('dark', store.dark);
}

/* =====================================================
   6. STUDY ROUND (screens)
   ===================================================== */
function startStudy(id, only) {
  const deck = store.findDeck(id);
  if (!deck || !deck.cardCount()) return;
  round = new StudyRound(deck, mode, only || deck.cards);
  if (!$('#page-study').classList.contains('active')) go('study');
  drawStudy();
}

function showResults() {
  store.recordSession(round.best);
  render();
  const acc = round.accuracy();
  $('#studyBox').innerHTML = `<div class="results"><small>Round complete</small><h2>${esc(round.deck.title)}</h2><div class="big">${acc}%</div><p class="muted">correct on first look · best streak ${round.best} · ${round.miss} missed</p><p class="motive">✦ ${Motivator.pick(acc)}</p><button class="primary" data-study="${round.deck.id}">Play again</button> ${round.missedCards.length ? `<button class="outline" data-retry="1">Retry missed (${round.missedCards.length})</button>` : ''} <button class="outline" id="stopBtn">Choose another deck</button></div>`;
  lastMissed = { id: round.deck.id, cards: round.missedCards };
  round = null;
}

function studyBody() {
  const c = round.current();
  const re = round.retype;
  if (round.mode === 'flip') {
    return round.flipped
      ? `<div class="qcard">${esc(c.a)}</div><div class="row2"><button class="primary" data-flip="1">I knew it</button><button class="outline" data-flip="0">Missed it</button></div>`
      : '<button class="primary" data-show="1">Show answer</button>';
  }
  if (round.mode === 'choice' && !re) {
    return `<div class="opts">${round.options().map((a, i) => `<button class="up" data-opt="${i}">${esc(a)}</button>`).join('')}</div>`;
  }
  return `<form id="ansForm" autocomplete="off"><input class="ans ${re ? 'bad' : ''}" id="ans" placeholder="${re ? 'Type the correct answer to continue' : 'Type your answer and press Enter'}" aria-label="Your answer" autocapitalize="off" spellcheck="false"></form>${re ? '' : '<div class="row2"><button class="outline" type="button" id="hintBtn">Hint</button><button class="outline" type="button" id="skipBtn">I don’t know</button></div>'}`;
}

function drawStudy(msg, cls) {
  if (round.isFinished()) return showResults();
  const c = round.current();
  $('#studyBox').innerHTML = `<div class="bar"><i style="width:${round.progress()}%"></i></div><div class="qcard">${esc(c.q)} <button class="icon" type="button" data-say="1" aria-label="Read aloud">🔊</button></div>${studyBody()}<div class="fb ${cls || ''}" aria-live="polite">${msg || ''}</div>`;
  const input = $('#ans');
  if (input) input.focus();
}

function nextCard() {
  round.advance();
  store.bump();
}

function wrong() {
  round.recordMiss();
  round.retype = true;
  drawStudy('Answer: ' + round.current().a + ' — type it to move on.', 'bad');
}

function grade(ok) {
  if (ok) round.recordHit(); else round.recordMiss();
  nextCard();
  drawStudy(ok ? 'Nice!' : '', 'ok');
}

function submitAnswer(v) {
  if (!round) return;
  const c = round.current();
  v = v.trim();

  if (round.retype) {                       // must type the right answer to continue
    if (norm(v) === norm(c.a)) {
      round.retype = false;
      nextCard();
      drawStudy('Got it. On to the next one.', '');
    } else {
      const input = $('#ans');
      input.value = '';
      input.classList.add('bad');
      $('.fb').textContent = 'Not quite. Correct answer: ' + c.a;
      $('.fb').className = 'fb bad';
    }
    return;
  }
  if (!v) return;
  if (c.isCorrect(v)) {
    round.recordHit();
    nextCard();
    drawStudy('Correct!', 'ok');
  } else {
    wrong();
  }
}

/* =====================================================
   7. EVENTS
   ===================================================== */
document.addEventListener('click', e => {
  const t = e.target.closest('button,a');
  if (!t) return;
  const d = t.dataset;

  if (d.page) { e.preventDefault(); return go(d.page); }
  if (d.action === 'new-deck') return new DeckEditor().open();
  if (d.action === 'new-note') return noteForm();
  if (d.study) return startStudy(d.study);
  if (d.editDeck) return new DeckEditor(store.findDeck(d.editDeck)).open();
  if (d.editNote) return noteForm(store.findNote(d.editNote));

  if (d.delDeck) {
    const i = store.decks.findIndex(x => x.id === d.delDeck);
    const [removed] = store.decks.splice(i, 1);
    store.save(); render();
    undoToast('Deck deleted', () => { store.decks.splice(i, 0, removed); store.save(); render(); });
  }
  if (d.delNote) {
    const i = store.notes.findIndex(x => x.id === d.delNote);
    const [removed] = store.notes.splice(i, 1);
    store.save(); render();
    undoToast('Note deleted', () => { store.notes.splice(i, 0, removed); store.save(); render(); });
  }
  if (d.mode) {
    mode = d.mode;
    $$('.mode').forEach(b => b.classList.toggle('on', b === t));
    return;
  }
  if (d.retry) return startStudy(lastMissed.id, lastMissed.cards);
  if (d.pin) {
    const deck = store.findDeck(d.pin);
    deck.pin = !deck.pin;
    store.save(); render();
  }
  if (d.opt && round) {
    const c = round.current();
    return norm(round.opts[+d.opt]) === norm(c.a) ? submitAnswer(c.a) : wrong();
  }
  if (d.show && round) { round.flipped = true; return drawStudy(); }
  if (d.flip && round) return grade(d.flip === '1');
  if (d.say && round) {
    try {
      const u = new SpeechSynthesisUtterance(round.current().q);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (x) {}
  }
  if (t.id === 'hintBtn' && round) {
    const a = round.current().a;
    $('.fb').textContent = 'Hint: starts with “' + a[0] + '” · ' + a.length + ' characters';
  }
  if (t.id === 'skipBtn' && round) wrong();
  if (t.id === 'stopBtn') $('#studyBox').innerHTML = '<div class="empty"><div>✧</div><h2>Pick a deck to play.</h2></div>';
  if (t.id === 'modalClose') closeModal();
  if (t.id === 'menuToggle') $('#sidebar').classList.toggle('open');
});

document.addEventListener('submit', e => {
  if (e.target.id === 'ansForm') { e.preventDefault(); submitAnswer($('#ans').value); }
});
$('#modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#deckSearch').oninput = $('#noteSearch').oninput = render;

$('#dark').onchange = e => { store.dark = e.target.checked; store.save(); render(); };

$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(store, null, 1)], { type: 'application/json' }));
  a.download = 'taladeck-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
};

$('#importFile').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.decks) || !Array.isArray(data.notes)) throw 0;
      store.load(data);
      store.save();
      render();
      toast('Backup restored');
    } catch (x) {
      toast('That file isn’t a TalaDeck backup');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

$('#profileForm').onsubmit = e => {
  e.preventDefault();
  store.user = { name: $('#displayName').value.trim(), user: $('#username').value.trim().replace(/^@/, '') };
  store.save();
  render();
  $('#profileFeedback').textContent = 'Profile saved.';
};
$$('[data-page="profile"]').forEach(b => b.addEventListener('click', () => {
  const u = store.userInfo();
  $('#displayName').value = u.name;
  $('#username').value = u.user;
  $('#profileFeedback').textContent = '';
}));

/* =====================================================
   8. START
   ===================================================== */
if (!store.sample && !store.decks.length) {
  store.decks.push(new Deck('Sample: Getting started', [
    new Card('What is the capital of France?', 'Paris'),
    new Card('2 + 2', '4'),
    new Card('Largest planet in our solar system', 'Jupiter')
  ]));
  store.sample = true;
  store.save();
}
render();
