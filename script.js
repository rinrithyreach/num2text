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

// Reads a typed number, allowing separators like "1,234" or "1 234"
function parseNumber(text) {
  const cleaned = text.replace(/[,\s_]/g, "");
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
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
  feedback: document.getElementById("feedback"),
  result: document.getElementById("result"),
  correctAnswer: document.getElementById("correct-answer"),
  yourAnswer: document.getElementById("your-answer"),
  next: document.getElementById("next"),
  correct: document.getElementById("correct"),
  wrong: document.getElementById("wrong"),
  streak: document.getElementById("streak"),
  reset: document.getElementById("reset"),
};

const score = { correct: 0, wrong: 0, streak: 0 };
let current = null; // { number, type: "num2words" | "words2num" }
let answered = false;
const timer = { id: null, deadline: 0, limit: 0 };

function randomInt(max) {
  return Math.floor(Math.random() * (max + 1));
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
    checkAnswer(true);
    return;
  }
  timer.id = requestAnimationFrame(tick);
}

function stopTimer() {
  cancelAnimationFrame(timer.id);
  timer.id = null;
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
  } catch {
    // Storage blocked or corrupted: keep the defaults
  }
  updateTimerLabel();
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      mode: el.mode.value,
      range: el.range.value,
      timer: el.timer.checked,
    }));
  } catch {
    // Storage blocked: settings just won't be remembered
  }
}

function newQuestion() {
  const max = Number(el.range.value);
  let number;
  do {
    number = randomInt(max);
  } while (current && number === current.number && max > 0);

  let type = el.mode.value;
  if (type === "random") type = Math.random() < 0.5 ? "num2words" : "words2num";

  current = { number, type };
  answered = false;

  if (type === "num2words") {
    el.instruction.textContent = "Write this number in words:";
    el.question.textContent = number.toLocaleString("en-US");
    el.question.classList.remove("words");
    el.answer.placeholder = "e.g. one hundred twenty-three";
    el.answer.inputMode = "text";
  } else {
    el.instruction.textContent = "Write these words as a number:";
    el.question.textContent = numberToWords(number);
    el.question.classList.add("words");
    el.answer.placeholder = "e.g. 123";
    el.answer.inputMode = "numeric";
  }

  el.answer.value = "";
  el.answer.disabled = false;
  el.submit.disabled = false;
  el.feedback.hidden = true;
  el.feedback.classList.remove("correct", "wrong");
  el.answer.focus();
  startTimer();
}

// timedOut = true when the timer ran out: whatever was typed is checked as-is
function checkAnswer(timedOut = false) {
  if (answered) return;

  const input = el.answer.value.trim();
  if (!input && !timedOut) {
    el.answer.classList.remove("shake");
    void el.answer.offsetWidth; // restart the animation
    el.answer.classList.add("shake");
    el.answer.focus();
    return;
  }

  const expectedWords = numberToWords(current.number);
  let isCorrect;
  let correctText;

  if (current.type === "num2words") {
    isCorrect = normalizeWords(input) === normalizeWords(expectedWords);
    correctText = expectedWords;
  } else {
    isCorrect = parseNumber(input) === current.number;
    correctText = current.number.toLocaleString("en-US");
  }

  answered = true;
  stopTimer();
  if (isCorrect) {
    score.correct++;
    score.streak++;
  } else {
    score.wrong++;
    score.streak = 0;
  }
  updateScore();

  el.result.textContent = isCorrect ? "✓ Correct!" : timedOut ? "⏱ Time's up!" : "✗ Not quite";
  el.correctAnswer.textContent = correctText;
  el.yourAnswer.textContent = input || "(no answer)";
  el.feedback.classList.add(isCorrect ? "correct" : "wrong");
  el.feedback.hidden = false;
  el.answer.disabled = true;
  el.submit.disabled = true;
  el.next.focus();
}

function updateScore() {
  el.correct.textContent = score.correct;
  el.wrong.textContent = score.wrong;
  el.streak.textContent = score.streak;
}

// ---------- Events ----------

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  checkAnswer(false);
});

el.next.addEventListener("click", newQuestion);

// Enter after answering moves to the next question
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && answered && document.activeElement !== el.next) {
    e.preventDefault();
    newQuestion();
  }
});

el.answer.addEventListener("animationend", () => el.answer.classList.remove("shake"));
el.mode.addEventListener("change", () => {
  saveSettings();
  newQuestion();
});
el.range.addEventListener("change", () => {
  saveSettings();
  newQuestion();
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
  el.answer.focus();
});

el.reset.addEventListener("click", () => {
  score.correct = score.wrong = score.streak = 0;
  updateScore();
  newQuestion();
});

loadSettings();
newQuestion();
