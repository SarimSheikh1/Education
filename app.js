// LingoSpark — Micro-courses & Flashcards (local-only demo)
// Data + state are stored in localStorage.
// You can extend COURSE_DATA to add more lessons and vocab.

const STORAGE_KEY = "lingospark_v1";

const COURSE_DATA = [
  {
    id: "spanish-basics-1",
    lang: "Spanish",
    title: "Spanish Basics 1",
    description: "Greetings, simple phrases, and essential verbs.",
    lessons: [
      {
        id: "greetings",
        title: "Greetings",
        content: [
          ["Hola", "Hello"],
          ["Buenos días", "Good morning"],
          ["Buenas tardes", "Good afternoon"],
          ["Buenas noches", "Good evening/night"],
          ["¿Cómo estás?", "How are you?"],
          ["Muy bien", "Very well"],
          ["Gracias", "Thank you"],
          ["Por favor", "Please"],
          ["Adiós", "Goodbye"],
        ],
      },
      {
        id: "introductions",
        title: "Introductions",
        content: [
          ["Me llamo…", "My name is…"],
          ["¿Cómo te llamas?", "What is your name?"],
          ["Mucho gusto", "Nice to meet you"],
          ["¿De dónde eres?", "Where are you from?"],
          ["Soy de…", "I am from…"],
        ],
      },
      {
        id: "basics",
        title: "Basics",
        content: [
          ["Sí", "Yes"],
          ["No", "No"],
          ["Perdón", "Sorry"],
          ["No entiendo", "I don’t understand"],
          ["¿Puedes repetir?", "Can you repeat?"],
          ["¿Dónde está el baño?", "Where is the bathroom?"],
          ["Quiero", "I want"],
          ["Necesito", "I need"],
          ["Tengo", "I have"],
          ["¿Cuánto cuesta?", "How much is it?"],
        ],
      },
    ],
  },
];

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (_) {}
  }
  // First-time state
  const cards = [];
  COURSE_DATA.forEach(course => {
    course.lessons.forEach(lesson => {
      lesson.content.forEach(([front, back], idx) => {
        cards.push({
          id: `${course.id}:${lesson.id}:${idx}`,
          courseId: course.id,
          front, back,
          ease: 2.5,      // SM-2 default
          interval: 0,    // in days
          repetitions: 0,
          dueISO: nowISO(),
          createdISO: nowISO(),
          lapses: 0,
        });
      });
    });
  });

  return {
    version: 1,
    user: {
      name: "Learner",
      streak: 0,
      lastStudyDayISO: null,
    },
    coursesProgress: {},  // { [courseId]: { completedLessons: [] } }
    cards,
    stats: { reviews: 0, correct: 0, wrong: 0 },
  };
}

let STATE = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
}

// --- Streak tracking
function bumpStreak() {
  const today = new Date(todayISO()).getTime();
  const last = STATE.user.lastStudyDayISO ? new Date(STATE.user.lastStudyDayISO).getTime() : null;

  if (last === null) {
    STATE.user.streak = 1;
  } else if (today === last) {
    // same day, nothing
  } else {
    const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) STATE.user.streak += 1;
    else STATE.user.streak = 1;
  }
  STATE.user.lastStudyDayISO = todayISO();
  saveState();
}

// --- SM-2 simplified scheduling
// q: 0..5 (we use 2,3,4,5)
function schedule(card, q) {
  const minEase = 1.3;
  const now = new Date();

  // Update ease
  let ease = card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < minEase) ease = minEase;

  if (q < 3) {
    card.repetitions = 0;
    card.interval = 1; // retry tomorrow
    card.lapses = (card.lapses || 0) + 1;
  } else {
    card.repetitions += 1;
    if (card.repetitions === 1) card.interval = 1;
    else if (card.repetitions === 2) card.interval = 6;
    else card.interval = Math.round(card.interval * ease);
  }

  card.ease = ease;
  const next = new Date(now.getTime() + card.interval * 24 * 60 * 60 * 1000);
  card.dueISO = next.toISOString();
  return card;
}

function isDue(card) {
  return new Date(card.dueISO) <= new Date();
}

function dueCounts() {
  const all = STATE.cards.filter(c => c.courseId === "spanish-basics-1");
  const due = all.filter(isDue);
  return { due: due.length, total: all.length };
}

// --- UI helpers
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(c));
  return node;
}

// --- Tabs
function setActiveTab(name) {
  $all(".tab").forEach(t => t.classList.remove("is-active"));
  $(`#tab-${name}`).classList.add("is-active");
  $all(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${name}"]`).classList.add("active");

  if (name === "flashcards") renderFlashcards();
  if (name === "courses") renderCourseList();
  if (name === "quiz") prepareQuizUI();
  if (name === "profile") renderProfile();
}

// --- Courses
function renderCourseList() {
  const wrap = $("#course-list");
  wrap.innerHTML = "";
  COURSE_DATA.forEach(course => {
    const completed = (STATE.coursesProgress[course.id]?.completedLessons || []).length;
    const totalLessons = course.lessons.length;

    const card = el("div", { class: "card" });
    card.appendChild(el("h3", { html: `${course.title}` }));
    card.appendChild(el("p", { class: "muted", html: course.description }));
    card.appendChild(el("p", { class: "muted small", html: `${completed}/${totalLessons} lessons completed` }));

    const list = el("div", { class: "list" });
    course.lessons.forEach(lsn => {
      const btn = el("button", { class: "btn", html: `Open: ${lsn.title}` });
      btn.addEventListener("click", () => openLesson(course, lsn));
      list.appendChild(el("div", {}, [btn]));
    });
    card.appendChild(list);
    wrap.appendChild(card);
  });
  $("#lesson").classList.add("hidden");
}

function openLesson(course, lesson) {
  const view = $("#lesson");
  view.classList.remove("hidden");
  view.innerHTML = "";

  view.appendChild(el("h3", { html: `${course.title} — ${lesson.title}` }));

  const tbl = el("table", { class: "list" });
  lesson.content.forEach(([front, back]) => {
    const row = el("div", { class: "flex-row gap" });
    row.appendChild(el("div", { class: "panel flex-1", html: `<strong>${front}</strong><br/><span class="muted">${back}</span>` }));
    tbl.appendChild(row);
  });
  view.appendChild(tbl);

  const done = el("button", { class: "btn ok", html: "Mark lesson complete" });
  done.addEventListener("click", () => {
    const cp = STATE.coursesProgress[course.id] || { completedLessons: [] };
    if (!cp.completedLessons.includes(lesson.id)) cp.completedLessons.push(lesson.id);
    STATE.coursesProgress[course.id] = cp;
    bumpStreak();
    saveState();
    renderCourseList();
    alert("Nice! Lesson marked complete.");
  });
  view.appendChild(el("div", { style: "margin-top:10px" }, [done]));
}

// --- Flashcards
let currentCard = null;
let showingBack = false;

function pickDueCard() {
  const due = STATE.cards.filter(isDue);
  if (due.length === 0) return null;
  // simple: pick the oldest due
  due.sort((a, b) => new Date(a.dueISO) - new Date(b.dueISO));
  return due[0];
}

function renderFlashcards() {
  const statsDiv = $("#fc-stats");
  const { due, total } = dueCounts();
  statsDiv.textContent = `Due: ${due} / ${total} • Reviews: ${STATE.stats.reviews}`;

  currentCard = pickDueCard();
  showingBack = false;

  const front = $("#flashcard-front");
  const back = $("#flashcard-back");
  const showBtn = $("#btn-show");
  const gradeRow = $("#grade-row");

  if (!currentCard) {
    front.textContent = "All caught up!";
    back.textContent = "";
    back.classList.add("hidden");
    showBtn.classList.add("hidden");
    gradeRow.classList.add("hidden");
    return;
  }

  front.textContent = currentCard.front;
  back.textContent = currentCard.back;

  back.classList.add("hidden");
  showBtn.classList.remove("hidden");
  gradeRow.classList.add("hidden");
}

function bindFlashcardControls() {
  $("#btn-show").addEventListener("click", () => {
    $("#flashcard-back").classList.remove("hidden");
    $("#grade-row").classList.remove("hidden");
    $("#btn-show").classList.add("hidden");
  });

  $all('#grade-row .btn').forEach(btn => {
    btn.addEventListener("click", (e) => {
      const q = Number(e.target.getAttribute("data-grade"));
      if (!currentCard) return;

      const prevDue = currentCard.dueISO;
      schedule(currentCard, q);
      // correctness stats
      if (q >= 4) STATE.stats.correct += 1; else STATE.stats.wrong += 1;
      STATE.stats.reviews += 1;
      bumpStreak();
      saveState();

      renderFlashcards();
    });
  });

  $("#btn-add-card").addEventListener("click", () => {
    const f = $("#new-front").value.trim();
    const b = $("#new-back").value.trim();
    const msg = $("#add-card-msg");
    if (!f || !b) {
      msg.textContent = "Please fill both fields.";
      return;
    }
    STATE.cards.push({
      id: `custom:${Date.now()}`,
      courseId: "custom",
      front: f, back: b,
      ease: 2.5, interval: 0, repetitions: 0,
      dueISO: nowISO(), createdISO: nowISO(), lapses: 0,
    });
    $("#new-front").value = ""; $("#new-back").value = "";
    msg.textContent = "Added. It will appear in your due queue.";
    saveState();
    renderFlashcards();
  });
}

// --- Quiz
let QUIZ = null;

function buildVocabPool() {
  const pool = [];
  COURSE_DATA.forEach(c =>
    c.lessons.forEach(lsn =>
      lsn.content.forEach(([front, back]) => pool.push({ front, back, courseId: c.id }))
    )
  );
  return pool;
}

function prepareQuizUI() {
  $("#quiz-status").textContent = "Press Start to begin.";
  $("#quiz-question").textContent = "";
  $("#quiz-choices").innerHTML = "";
  $("#btn-next").classList.add("hidden");
  $("#btn-start-quiz").classList.remove("hidden");
}

function startQuiz() {
  const pool = buildVocabPool();
  // pick 10 random
  const items = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
  QUIZ = {
    idx: 0,
    score: 0,
    items,
  };
  renderQuizQ();
}

function renderQuizQ() {
  const item = QUIZ.items[QUIZ.idx];
  $("#quiz-status").textContent = `Question ${QUIZ.idx + 1} of ${QUIZ.items.length} • Score: ${QUIZ.score}`;

  $("#quiz-question").textContent = `What is the meaning of: "${item.front}"?`;

  const distractors = buildVocabPool()
    .filter(it => it.back !== item.back)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(it => it.back);

  const options = [...distractors, item.back].sort(() => Math.random() - 0.5);
  const choices = $("#quiz-choices");
  choices.innerHTML = "";
  options.forEach(opt => {
    const btn = el("button", { class: "btn choice", html: opt });
    btn.addEventListener("click", () => {
      $all(".choice").forEach(b => b.disabled = true);
      if (opt === item.back) {
        btn.classList.add("correct");
        QUIZ.score += 1;
      } else {
        btn.classList.add("wrong");
        // highlight correct
        $all(".choice").forEach(b => { if (b.textContent === item.back) b.classList.add("correct"); });
      }
      $("#btn-next").classList.remove("hidden");
      bumpStreak();
      saveState();
    });
    choices.appendChild(btn);
  });

  $("#btn-next").onclick = () => {
    QUIZ.idx += 1;
    if (QUIZ.idx >= QUIZ.items.length) {
      $("#quiz-status").textContent = `Done! Final score: ${QUIZ.score}/${QUIZ.items.length}`;
      $("#quiz-question").textContent = "Great work.";
      $("#quiz-choices").innerHTML = "";
      $("#btn-next").classList.add("hidden");
      $("#btn-start-quiz").classList.remove("hidden");
    } else {
      renderQuizQ();
      $("#btn-next").classList.add("hidden");
    }
  };
}

// --- Profile
function renderProfile() {
  const s = STATE.user.streak || 0;
  $("#streak-line").textContent = `${s} day${s === 1 ? "" : "s"} in a row`;

  const { due, total } = dueCounts();
  $("#deck-summary").innerHTML = `
    <li>Total cards: ${total}</li>
    <li>Due now: ${due}</li>
    <li>Lifetime reviews: ${STATE.stats.reviews}</li>
    <li>Correct: ${STATE.stats.correct}, Wrong: ${STATE.stats.wrong}</li>
  `;
}

// --- Export/Import
function exportData() {
  const data = JSON.stringify(STATE, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "lingospark-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(e.target.result);
      if (!obj || !obj.cards) throw new Error("Invalid file");
      STATE = obj;
      saveState();
      setActiveTab("profile");
      alert("Import successful.");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

// --- Event bindings
function bindTabs() {
  $all(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function bindQuizButtons() {
  $("#btn-start-quiz").addEventListener("click", () => {
    startQuiz();
    $("#btn-start-quiz").classList.add("hidden");
  });
}

function bindExportImport() {
  $("#btn-export").addEventListener("click", exportData);
  $("#btn-import").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
  });
}

// --- Boot
function init() {
  bindTabs();
  bindFlashcardControls();
  bindQuizButtons();
  bindExportImport();
  renderCourseList();
  setActiveTab("courses");
}

document.addEventListener("DOMContentLoaded", init);

function renderProfile() {
  const s = STATE.user.streak || 0;
  $("#streak-line").textContent = `${s} day${s === 1 ? "" : "s"} in a row`;

  const { due, total } = dueCounts();
  $("#deck-summary").innerHTML = `
    <li>Total cards: ${total}</li>
    <li>Due now: ${due}</li>
    <li>Lifetime reviews: ${STATE.stats.reviews}</li>
    <li>Correct: ${STATE.stats.correct}, Wrong: ${STATE.stats.wrong}</li>
  `;

  // Daily goal tracker
  const todayReviews = STATE.stats.reviewsToday || 0;
  $("#daily-goal").value = todayReviews;
  $("#goal-msg").textContent = `${todayReviews}/20 reviews done today`;

  // Word of the day (just pick a vocab item)
  const pool = buildVocabPool();
  const seed = new Date().toISOString().slice(0,10);
  const index = seed.split("-").reduce((a,b)=>a+parseInt(b),0) % pool.length;
  const word = pool[index];
  $("#word-of-day").textContent = word.front;
  $("#word-meaning").textContent = word.back;
}


function schedule(card, q) {
  
  // After scheduling
  STATE.stats.reviewsToday = (STATE.stats.reviewsToday || 0) + 1;
  return card;
}

function bumpStreak() {
  const today = todayISO();
  const last = STATE.user.lastStudyDayISO;

  if (!last || last !== today) {
    STATE.stats.reviewsToday = 0; // reset daily
  }
  
}
