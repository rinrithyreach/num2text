// ---------- Number <-> words conversion ----------

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion"];

// Converts 1..999 to words, e.g. 342 -> "three hundred forty-two"
function chunkToWords(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)] + " hundred");
    n %= 100;
  }
  if (n >= 20) {
    let word = TENS[Math.floor(n / 10)];
    if (n % 10) word += "-" + ONES[n % 10];
    parts.push(word);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

// Converts a whole number (0..999,999,999,999) to English words
function numberToWords(n) {
  if (n === 0) return "zero";
  const parts = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) {
      parts.unshift(chunkToWords(chunk) + (SCALES[scale] ? " " + SCALES[scale] : ""));
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  return parts.join(" ");
}

// Makes word answers comparable: ignores case, hyphens, commas, extra spaces and "and"
function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[-,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "and")
    .join(" ");
}

// Reads a typed number in English or Khmer digits (០–៩), allowing separators like
// "1,234", "1 234" or "1.234" (dots only when grouped in threes, as often written in Khmer)
function parseNumber(text) {
  const cleaned = text
    .replace(/[០-៩]/g, (d) => d.charCodeAt(0) - 0x17e0)
    .replace(/[,\s_]/g, "");
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g, ""));
  return null;
}

// ---------- Khmer number words ----------

// Khmer builds 6–9 as 5+n (ប្រាំមួយ = "five-one" = 6) and counts below a million with
// ពាន់ (1,000), ម៉ឺន (10,000) and សែន (100,000), then លាន (1,000,000).
const KHMER_DIGIT_WORDS = ["សូន្យ", "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ", "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន"];
const KHMER_TENS = ["", "ដប់", "ម្ភៃ", "សាមសិប", "សែសិប", "ហាសិប", "ហុកសិប", "ចិតសិប", "ប៉ែតសិប", "កៅសិប"];
const KHMER_UNITS = [[100000, "សែន"], [10000, "ម៉ឺន"], [1000, "ពាន់"]];

// 1..999 as a list of words, e.g. 125 -> ["មួយ", "រយ", "ម្ភៃ", "ប្រាំ"]
function khmerBelowThousand(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(KHMER_DIGIT_WORDS[Math.floor(n / 100)], "រយ");
    n %= 100;
  }
  if (n >= 10) {
    parts.push(KHMER_TENS[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(KHMER_DIGIT_WORDS[n]);
  return parts;
}

// Whole number (0..999,999,999) in Khmer words, traditional style:
// 15,000 -> មួយម៉ឺនប្រាំពាន់. Words are joined with zero-width spaces, the usual
// invisible line-break points in Khmer text, so long numbers can wrap.
function numberToKhmer(n) {
  if (n === 0) return KHMER_DIGIT_WORDS[0];
  const parts = [];
  const millions = Math.floor(n / 1e6);
  if (millions) parts.push(...khmerBelowThousand(millions), "លាន");
  let rest = n % 1e6;
  for (const [value, word] of KHMER_UNITS) {
    const count = Math.floor(rest / value);
    if (count) parts.push(KHMER_DIGIT_WORDS[count], word);
    rest %= value;
  }
  if (rest) parts.push(...khmerBelowThousand(rest));
  return parts.join("​");
}

// [spelling, value, kind]; longest spellings first so e.g. សែសិប (40) wins over សែន
const KHMER_TOKENS = [
  ["សូន្យ", 0, "digit"], ["មួយ", 1, "digit"], ["ពីរ", 2, "digit"], ["បី", 3, "digit"],
  ["បួន", 4, "digit"], ["ប្រាំ", 5, "digit"],
  ["ដប់", 10, "ten"], ["ម្ភៃ", 20, "ten"], ["សាមសិប", 30, "ten"], ["សែសិប", 40, "ten"],
  ["ហាសិប", 50, "ten"], ["ហុកសិប", 60, "ten"], ["ចិតសិប", 70, "ten"], ["ប៉ែតសិប", 80, "ten"],
  ["បែ៉តសិប", 80, "ten"], ["កៅសិប", 90, "ten"],
  ["រយ", 100, "hundred"],
  ["ពាន់", 1000, "unit"], ["ម៉ឺន", 10000, "unit"], ["មឺ៉ន", 10000, "unit"],
  ["សែន", 100000, "unit"], ["លាន", 1000000, "unit"],
].sort((a, b) => b[0].length - a[0].length);

// Splits typed Khmer into number words; null if anything isn't one.
// Spaces, zero-width spaces and punctuation between words are ignored.
function tokenizeKhmer(text) {
  const s = text.normalize("NFC").replace(/[\s​-‍,.\-។]/g, "");
  const tokens = [];
  for (let i = 0; i < s.length; ) {
    const match = KHMER_TOKENS.find(([word]) => s.startsWith(word, i));
    if (!match) return null;
    tokens.push({ value: match[1], kind: match[2] });
    i += match[0].length;
  }
  return tokens;
}

// 1..999 from words like មួយរយម្ភៃប្រាំ; null if they don't form a proper number
function khmerSmallValue(tokens) {
  let i = 0;
  // 1–9: a digit word, or ប្រាំ + មួយ..បួន for 6–9
  const readOneToNine = () => {
    const t = tokens[i];
    if (t?.kind !== "digit" || t.value === 0) return null;
    i++;
    let value = t.value;
    const next = tokens[i];
    if (value === 5 && next?.kind === "digit" && next.value >= 1 && next.value <= 4) {
      value += next.value;
      i++;
    }
    return value;
  };
  let value = 0;
  const start = i;
  const hundreds = readOneToNine();
  if (hundreds && tokens[i]?.kind === "hundred") {
    value += hundreds * 100;
    i++;
  } else {
    i = start;
  }
  if (tokens[i]?.kind === "ten") value += tokens[i++].value;
  if (i < tokens.length) {
    const ones = readOneToNine();
    if (!ones) return null;
    value += ones;
  }
  return i === tokens.length && value > 0 ? value : null;
}

// Reads Khmer number words back into a number, or null if they aren't valid. Accepts the
// traditional ម៉ឺន/សែន style and the common ពាន់-only style (ដប់ប្រាំពាន់ = 15,000, also
// ម្ភៃម៉ឺន = 200,000), as long as the units go from big to small.
function parseKhmerWords(text) {
  const tokens = tokenizeKhmer(text);
  if (!tokens?.length) return null;
  if (tokens.length === 1 && tokens[0].value === 0) return 0;

  let millions = 0;
  let below = 0; // part under a million, built from សែន/ម៉ឺន/ពាន់ amounts
  let cap = 1e6; // each unit and its amount must stay under the previous unit
  let buffer = [];
  for (const token of tokens) {
    if (token.kind !== "unit") {
      buffer.push(token);
      continue;
    }
    const count = khmerSmallValue(buffer);
    buffer = [];
    if (!count) return null;
    if (token.value === 1e6) {
      if (millions || below) return null;
      millions = count;
      continue;
    }
    const amount = count * token.value;
    if (token.value >= cap || amount >= cap) return null;
    below += amount;
    cap = token.value;
  }
  const rest = buffer.length ? khmerSmallValue(buffer) : 0;
  if (rest === null) return null;
  return millions * 1e6 + below + rest;
}

// ---------- Quiz state ----------

const el = {
  mode: document.getElementById("mode"),
  range: document.getElementById("range"),
  timer: document.getElementById("timer"),
  timerState: document.getElementById("timer-state"),
  timerBox: document.getElementById("timer-box"),
  timerBar: document.getElementById("timer-bar"),
  timerText: document.getElementById("timer-text"),
  instruction: document.getElementById("instruction"),
  question: document.getElementById("question"),
  form: document.getElementById("answer-form"),
  answer: document.getElementById("answer"),
  submit: document.getElementById("submit"),
  skip: document.getElementById("skip"),
  announce: document.getElementById("announce"),
  feedback: document.getElementById("feedback"),
  result: document.getElementById("result"),
  correctAnswer: document.getElementById("correct-answer"),
  next: document.getElementById("next"),
  correct: document.getElementById("correct"),
  wrong: document.getElementById("wrong"),
  streak: document.getElementById("streak"),
  best: document.getElementById("best"),
  reset: document.getElementById("reset"),
  theme: document.getElementById("theme"),
  digits: document.getElementById("digits"),
  words: document.getElementById("words"),
};

// streaks: { [range]: { current, best } }, see "Saved score" below
const score = { correct: 0, wrong: 0, streaks: {} };
let current = null; // { number, type: "num2words" | "words2num" }
let answered = false;
// Unanswered question per "range|mode", so reloading or flipping settings can't skip it
let pending = {};
// pausedLeft: ms remaining while the tab is hidden, null otherwise
const timer = { id: null, deadline: 0, limit: 0, pausedLeft: null };
let theme = "light"; // "light" | "dark"
function randomInt(max) {
  return Math.floor(Math.random() * (max + 1));
}

// ---------- Picking numbers ----------

// Chance that a question gets "traps" added (see addTraps)
const TRAP_CHANCE = 0.35;

// Picks how many digits first, then a number of that length. Picking 0..max uniformly would
// make ~90% of 0–999,999,999 questions 9 digits long; this way every length shows up, with
// longer numbers still more common. A length only partly inside the range (e.g. just "100"
// in 0–100) gets a proportionally tiny weight.
function randomNumber(max) {
  const buckets = [];
  for (let len = 1, lo = 0; lo <= max; len++, lo = 10 ** (len - 1)) {
    const hi = Math.min(10 ** len - 1, max);
    const fullSize = len === 1 ? 10 : 9 * 10 ** (len - 1);
    buckets.push({ lo, hi, weight: (len * (hi - lo + 1)) / fullSize });
  }
  let pick = Math.random() * buckets.reduce((sum, b) => sum + b.weight, 0);
  const bucket = buckets.find((b) => (pick -= b.weight) < 0) ?? buckets.at(-1);
  return bucket.lo + randomInt(bucket.hi - bucket.lo);
}

// Rewrites some digits into the classic traps: zeros in the middle (1,005 / 20,040)
// and teens inside bigger numbers (112,017)
function addTraps(n, max) {
  const digits = [...String(n)];
  for (let i = 1; i < digits.length; i++) {
    const isTens = (digits.length - 1 - i) % 3 === 1; // tens digit within its group of three
    const r = Math.random();
    if (r < 0.35) digits[i] = "0";
    else if (isTens && r < 0.6) digits[i] = "1";
  }
  return Math.min(Number(digits.join("")), max);
}

function pickNumber(max) {
  const n = randomNumber(max);
  return Math.random() < TRAP_CHANCE ? addTraps(n, max) : n;
}

function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Restarts a one-shot CSS animation class (e.g. "shake", "bump") on an element
function playAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // restart the animation
  element.classList.add(className);
  const done = (e) => {
    if (e.target !== element) return; // ignore animations bubbling up from children
    element.classList.remove(className);
    element.removeEventListener("animationend", done);
  };
  element.addEventListener("animationend", done);
}

// ---------- Theme ----------

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  el.theme.setAttribute("aria-pressed", String(theme === "dark"));
}

// The new theme grows as a circle out of the toggle button, where the browser supports it
function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  const swap = () => {
    applyTheme();
    saveSettings();
  };

  if (!document.startViewTransition || prefersReducedMotion()) {
    swap();
    return;
  }

  const box = el.theme.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  document.startViewTransition(swap).ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      // Transition was skipped (e.g. toggled again mid-animation): the theme still switched
    });
}

// ---------- Digits and words ----------

// Two display settings, each cycled by a button in the controls:
// - digits: numbers in English digits, Khmer digits (០–៩), or mixed
// - words: number words in English, Khmer, or mixed
// "Mixed" picks per question (its `khmer` / `khmerWords` flags). Typed numbers are accepted
// in either digit script whatever the setting.
const DISPLAY_OPTIONS = {
  digits: {
    western: { label: "123", name: "English" },
    khmer: { label: "១២៣", name: "Khmer" },
    mixed: { label: "1២3", name: "Mixed" },
  },
  words: {
    english: { label: "English", name: "English" },
    khmer: { label: "ខ្មែរ", name: "Khmer" },
    mixed: { label: "Mixed", name: "Mixed" },
  },
};
const display = { digits: "western", words: "english" };

function updateDisplayButton(setting) {
  const { label, name } = DISPLAY_OPTIONS[setting][display[setting]];
  const title = setting[0].toUpperCase() + setting.slice(1);
  el[setting].textContent = label;
  el[setting].setAttribute("aria-label", `${title}: ${name}`);
  el[setting].title = `${title}: ${name} (click to change)`;
}

// Next option; the current question (and its answer, if shown) switch in place
function cycleDisplay(setting) {
  const keys = Object.keys(DISPLAY_OPTIONS[setting]);
  display[setting] = keys[(keys.indexOf(display[setting]) + 1) % keys.length];
  updateDisplayButton(setting);
  playAnimation(el[setting], "flip");
  saveSettings();
  renderQuestion();
  if (answered) showCorrectAnswer();
  else refocusAnswer();
}

function showsKhmerDigits() {
  return display.digits === "khmer" || (display.digits === "mixed" && current?.khmer === true);
}

function showsKhmerWords() {
  return display.words === "khmer" || (display.words === "mixed" && current?.khmerWords === true);
}

// 1234 -> "1,234", or "១,២៣៤" when this question uses Khmer digits
function formatNumber(n) {
  return n.toLocaleString("en-US", showsKhmerDigits() ? { numberingSystem: "khmr" } : {});
}

function formatWords(n) {
  return showsKhmerWords() ? numberToKhmer(n) : numberToWords(n);
}

// Marks text as Khmer, for screen readers and the Khmer line-height
function setKhmerLang(element, isKhmer) {
  if (isKhmer) element.lang = "km";
  else element.removeAttribute("lang");
}

// ---------- Timer ----------

// Seconds allowed for a question: longer numbers/words get more time.
// Writing words takes longer to type than digits, so num2words gets more per word.
function timeLimitFor(question) {
  const words = numberToWords(question.number).split(/[\s-]+/).length;
  const digits = String(question.number).length;
  const seconds = question.type === "num2words"
    ? 5 + 2.5 * words
    : 4 + words + 0.5 * digits;
  return Math.max(5, Math.ceil(seconds));
}

function startTimer() {
  stopTimer();
  timer.pausedLeft = null;
  if (!el.timer.checked) {
    el.timerBox.hidden = true;
    return;
  }
  timer.limit = timeLimitFor(current) * 1000;
  timer.deadline = performance.now() + timer.limit;
  el.timerBox.hidden = false;
  tick();
}

// Runs once per screen frame so the bar moves smoothly
function tick() {
  const left = Math.max(0, timer.deadline - performance.now());
  const fraction = left / timer.limit;
  el.timerBar.style.transform = `scaleX(${fraction})`;
  const text = Math.ceil(left / 1000) + "s";
  if (el.timerText.textContent !== text) el.timerText.textContent = text;
  el.timerBox.classList.toggle("low", fraction <= 0.25);
  if (left <= 0) {
    stopTimer();
    checkAnswer("timeout");
    return;
  }
  timer.id = requestAnimationFrame(tick);
}

function stopTimer() {
  cancelAnimationFrame(timer.id);
  timer.id = null;
}

// Hidden tabs (or a phone switching apps) stop drawing frames but the clock keeps going,
// so without this you'd come back to an instant "Time's up". Freeze the time left instead.
function pauseTimer() {
  if (timer.id === null) return;
  timer.pausedLeft = Math.max(0, timer.deadline - performance.now());
  stopTimer();
}

function resumeTimer() {
  if (timer.pausedLeft === null) return;
  timer.deadline = performance.now() + timer.pausedLeft;
  timer.pausedLeft = null;
  tick();
}

function updateTimerLabel() {
  el.timerState.textContent = el.timer.checked ? "On" : "Off";
}

// ---------- Saved settings ----------

const SETTINGS_KEY = "num2text-settings";

// Sets a <select> to a saved value, keeping the default if that option no longer exists
function restoreSelect(select, value) {
  const fallback = select.value;
  select.value = value;
  if (select.selectedIndex === -1) select.value = fallback;
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    if (saved.mode) restoreSelect(el.mode, saved.mode);
    if (saved.range) restoreSelect(el.range, saved.range);
    el.timer.checked = saved.timer === true;
    theme = saved.theme === "dark" ? "dark" : "light";
    for (const setting of Object.keys(display)) {
      if (Object.hasOwn(DISPLAY_OPTIONS[setting], saved[setting])) display[setting] = saved[setting];
    }
  } catch {
    // Storage blocked or corrupted: keep the defaults
  }
  updateTimerLabel();
  applyTheme();
  updateDisplayButton("digits");
  updateDisplayButton("words");
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      mode: el.mode.value,
      range: el.range.value,
      timer: el.timer.checked,
      theme,
      ...display,
    }));
  } catch {
    // Storage blocked: settings just won't be remembered
  }
}

// ---------- Saved score ----------

// Correct/wrong are overall totals. Streaks are kept per range, since 10 in a row on
// 0–100 isn't comparable with 10 on 0–999,999,999. "Reset score" keeps each range's best.
// The unanswered questions (`pending`) are saved alongside.
const STATS_KEY = "num2text-stats";

function rangeStreak() {
  return (score.streaks[el.range.value] ??= { current: 0, best: 0 });
}

// Saved values are only trusted if they're whole, non-negative numbers
function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY)) || {};
    score.correct = toCount(saved.correct);
    score.wrong = toCount(saved.wrong);
    for (const [range, streak] of Object.entries(saved.streaks || {})) {
      const current = toCount(streak?.current);
      score.streaks[range] = { current, best: Math.max(current, toCount(streak?.best)) };
    }
    if (saved.pending && typeof saved.pending === "object") pending = saved.pending;
  } catch {
    // Storage blocked or corrupted: start from zero
  }
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify({ ...score, pending }));
  } catch {
    // Storage blocked: the score just won't survive a reload
  }
}

function pendingKey() {
  return el.range.value + "|" + el.mode.value;
}

// The saved unanswered question for the current range and mode, if it's still valid
function restorePending() {
  const q = pending[pendingKey()];
  const typeOk = (q?.type === "num2words" || q?.type === "words2num")
    && (el.mode.value === "random" || q.type === el.mode.value);
  const numberOk = toCount(q?.number) === q?.number && q.number <= Number(el.range.value);
  return typeOk && numberOk ? q : null;
}

function makeQuestion() {
  const max = Number(el.range.value);
  let number;
  do {
    number = pickNumber(max);
  } while (current && number === current.number && max > 0);

  let type = el.mode.value;
  if (type === "random") type = Math.random() < 0.5 ? "num2words" : "words2num";
  return { number, type, khmer: Math.random() < 0.5, khmerWords: Math.random() < 0.5 };
}

// Fills in the question for `current`; re-run when the digits/words settings change
function renderQuestion() {
  const { number, type } = current;
  const khmerWords = showsKhmerWords();

  if (type === "num2words") {
    el.instruction.textContent = khmerWords ? "Write this number in Khmer words:" : "Write this number in words:";
    el.question.textContent = formatNumber(number);
    el.question.classList.remove("words");
    if (!answered) el.answer.placeholder = khmerWords ? "e.g. មួយរយម្ភៃបី" : "e.g. one hundred twenty-three";
    el.answer.inputMode = "text";
    setKhmerLang(el.question, showsKhmerDigits());
  } else {
    el.instruction.textContent = "Write these words as a number:";
    el.question.textContent = formatWords(number);
    el.question.classList.add("words");
    if (!answered) el.answer.placeholder = showsKhmerDigits() ? "e.g. ១២៣" : "e.g. 123";
    el.answer.inputMode = "numeric";
    setKhmerLang(el.question, khmerWords);
  }
}

function correctAnswerText() {
  return current.type === "num2words" ? formatWords(current.number) : formatNumber(current.number);
}

function showCorrectAnswer() {
  el.correctAnswer.textContent = correctAnswerText();
  setKhmerLang(el.correctAnswer, current.type === "num2words" ? showsKhmerWords() : showsKhmerDigits());
}

// Shows the unanswered question for this range/mode if there is one, otherwise a new one
function newQuestion() {
  current = restorePending() ?? makeQuestion();
  pending[pendingKey()] = current;
  saveStats();
  answered = false;
  renderQuestion();
  playAnimation(el.question, "swap");

  el.answer.value = "";
  el.answer.disabled = false;
  el.skip.hidden = false;
  el.submit.hidden = false;
  el.next.hidden = true;
  el.feedback.hidden = true;
  el.feedback.classList.remove("correct", "wrong");
  el.announce.textContent = ""; // so the next result is a change and gets read out
  el.answer.focus();
  startTimer();
}

const OUTCOMES = {
  correct: { icon: "✓", text: "Correct!" },
  wrong: { icon: "✗", text: "Not quite" },
  timeout: { icon: "⏱", text: "Time's up!" },
  skip: { icon: "↷", text: "Skipped" },
};

// reason: "submit" (Submit/Enter), "timeout" (timer ran out: whatever was typed is checked
// as-is) or "skip" (Skip button: counts as wrong and resets the streak)
function checkAnswer(reason = "submit") {
  if (answered) return;

  const input = el.answer.value.trim();
  if (!input && reason === "submit") {
    playAnimation(el.answer, "shake");
    el.answer.focus();
    return;
  }

  let isCorrect;
  if (current.type === "words2num") isCorrect = parseNumber(input) === current.number;
  else if (showsKhmerWords()) isCorrect = parseKhmerWords(input) === current.number;
  else isCorrect = normalizeWords(input) === normalizeWords(numberToWords(current.number));
  if (reason === "skip") isCorrect = false;
  const correctText = correctAnswerText();

  answered = true;
  stopTimer();
  delete pending[pendingKey()];
  const streak = rangeStreak();
  if (isCorrect) {
    score.correct++;
    streak.current++;
    playAnimation(el.correct.parentElement, "bump");
    playAnimation(el.streak.closest(".stat"), "bump");
    if (streak.current > streak.best) {
      streak.best = streak.current;
      playAnimation(el.best, "bump");
    }
  } else {
    score.wrong++;
    streak.current = 0;
    playAnimation(el.wrong.parentElement, "bump");
  }
  updateScore();
  saveStats();

  const outcome = OUTCOMES[isCorrect ? "correct" : reason === "submit" ? "wrong" : reason];
  el.result.textContent = `${outcome.icon} ${outcome.text}`;
  showCorrectAnswer();
  el.feedback.classList.add(isCorrect ? "correct" : "wrong");
  el.feedback.hidden = false;
  el.announce.textContent = isCorrect ? outcome.text : `${outcome.text}. The answer is ${correctText}.`;

  // The typed answer stays in the (now locked) input; Next takes Submit's place
  if (!input) el.answer.placeholder = "(no answer)";
  el.answer.disabled = true;
  el.skip.hidden = true;
  el.submit.hidden = true;
  el.next.hidden = false;
  el.next.focus({ preventScroll: true });
  // Bring the result into view if it landed below the fold (short screens, open keyboard)
  el.feedback.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

// Shows the totals and the streak for the selected range
function updateScore() {
  const streak = rangeStreak();
  el.correct.textContent = score.correct;
  el.wrong.textContent = score.wrong;
  el.streak.textContent = streak.current;
  el.best.textContent = "Best " + streak.best;
  // Highlighted while the current run is the record
  el.best.classList.toggle("record", streak.current > 0 && streak.current === streak.best);
}

// ---------- Events ----------

// After a setting changes, put the cursor back in the answer box. Desktop only: on a phone
// it would pop the keyboard up. Deferred so it runs after the dropdown hands focus back to itself.
function refocusAnswer() {
  if (matchMedia("(pointer: fine)").matches) setTimeout(() => el.answer.focus());
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  checkAnswer("submit");
});

el.skip.addEventListener("click", () => checkAnswer("skip"));
el.next.addEventListener("click", newQuestion);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseTimer();
  else resumeTimer();
});

// Enter after answering moves to the next question (a focused button handles Enter itself)
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && answered && !(document.activeElement instanceof HTMLButtonElement)) {
    e.preventDefault();
    newQuestion();
  }
});

el.theme.addEventListener("click", toggleTheme);

el.digits.addEventListener("click", () => cycleDisplay("digits"));
el.words.addEventListener("click", () => cycleDisplay("words"));
el.mode.addEventListener("change", () => {
  saveSettings();
  newQuestion();
  refocusAnswer();
});
el.range.addEventListener("change", () => {
  saveSettings();
  updateScore(); // show this range's streak
  newQuestion();
  refocusAnswer();
});
// Turning the timer on/off applies to the current question without skipping it
el.timer.addEventListener("change", () => {
  updateTimerLabel();
  saveSettings();
  if (answered) {
    if (!el.timer.checked) el.timerBox.hidden = true;
    return;
  }
  startTimer();
  refocusAnswer();
});

// Clears the totals, current streaks and waiting questions; each range's best streak is kept
el.reset.addEventListener("click", () => {
  score.correct = score.wrong = 0;
  for (const streak of Object.values(score.streaks)) streak.current = 0;
  pending = {};
  updateScore();
  newQuestion(); // also saves
});

loadSettings();
loadStats();
updateScore();
newQuestion();
