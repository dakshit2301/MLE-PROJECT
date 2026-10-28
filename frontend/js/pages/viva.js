/*
Purpose: Provide searchable viva flashcards and self-review.
Inputs: Saved questions, dataset metadata, and local progress.
Outputs: Practice controls with persisted progress and cleanup.
*/
import { el, toast } from "../ui.js";

const STORAGE_KEY = "study-lab-viva-progress-v1";
let cleanup = [];

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, status]) =>
      status === "review" || status === "got-it"));
  } catch (error) {
    console.error("Could not read viva progress.", error);
    return {};
  }
}

function practiceText(question, answer, meta) {
  if (question.startsWith("Q11.")) {
    return {
      question,
      answer: "Data leakage occurs when information from outside the training data, such as test-set statistics or future target values, influences model training. This can yield overly optimistic validation scores and weaker performance on unseen data.",
    };
  }
  if (question.startsWith("Q39.")) {
    return {
      question: "Q39. Tricky: If study hours predict marks, why can't a principal recommend additional study hours based only on this model?",
      answer: "The model reflects an observational association, not evidence from an experiment. Study hours may proxy for other factors. Without an appropriate experiment, we cannot conclude that extra study time by itself would change grades.",
    };
  }
  if (question.startsWith("Q5.")) {
    return {
      question,
      answer: `The Exam_Score mean is ${meta.target_stats.mean.toFixed(2)} marks and the standard deviation is ${meta.target_stats.std.toFixed(2)} marks. The recorded score range is ${meta.target_stats.min}–${meta.target_stats.max}; the exported distribution has a small high-score tail.`,
    };
  }
  return { question, answer };
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export async function render(container, context) {
  destroy();
  const [source, meta] = await Promise.all([
    context.loadJSON("viva.json"),
    context.loadJSON("meta.json"),
  ]);
  const items = source.map((item, index) => ({
    ...practiceText(item.question, item.answer, meta),
    group: item.group,
    id: item.question || `question-${index}`,
  }));
  let progress = readProgress();
  let query = "";
  let selectedTopic = "All topics";
  let reviewOnly = false;
  let mode = "flashcards";
  let deck = [];
  let position = 0;
  let showAnswer = false;
  let sessionReviewed = 0;
  let sessionGotIt = 0;
  let quizScore = 0;
  let quizRated = 0;
  let quizRevealed = false;
  const quizDrafts = new Map();
  let shuffled = false;

  const section = el("section", { className: "page-shell fe04-page viva-page" },
    el("p", { className: "page-shell__eyebrow", text: "Practice and review" }),
    el("h1", { className: "page-shell__title", text: "Viva practice" }),
    el("p", { className: "page-shell__purpose", text: "Review the project’s saved viva questions. Self-ratings are for your own practice; answers are never automatically graded." }),
  );
  const filters = el("section", { className: "card stack viva-filters", "aria-label": "Question filters" });
  const controls = el("div", { className: "viva-controls" });
  const modeButtons = el("div", { className: "segmented", role: "group", "aria-label": "Practice mode" });
  const panel = el("section", { className: "viva-panel", "aria-live": "polite" });
  const status = el("p", { className: "small viva-status", role: "status", "aria-live": "polite" });

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error("Could not save viva progress.", error);
      status.textContent = "Progress could not be saved in this browser.";
      toast("Progress could not be saved.");
    }
  }

  function availableItems() {
    return items.filter((item) => {
      const matchesTopic = selectedTopic === "All topics" || item.group === selectedTopic;
      const matchesText = !query || `${item.question} ${item.answer} ${item.group}`.toLocaleLowerCase().includes(query);
      const matchesReview = !reviewOnly || progress[item.id] === "review";
      return matchesTopic && matchesText && matchesReview;
    });
  }

  function startDeck({ shuffleCards = false } = {}) {
    const nextDeck = availableItems();
    deck = shuffleCards ? shuffle(nextDeck) : nextDeck;
    position = 0;
    showAnswer = false;
    quizRevealed = false;
    shuffled = shuffleCards;
    renderPanel();
  }

  function progressBar(current, total) {
    const progressElement = el("progress", {
      className: "viva-progress",
      max: Math.max(1, total),
      value: current,
      "aria-label": `Practice progress: ${current} of ${total}`,
    });
    return el("div", { className: "viva-progress-wrap" },
      progressElement,
      el("span", { className: "small num", text: `${current} / ${total}` }),
    );
  }

  function renderPanel() {
    panel.replaceChildren();
    const current = deck[position];
    if (!current) {
      const count = availableItems().length;
      panel.append(el("article", { className: "card stack viva-empty" },
        el("h2", { className: "h2", text: count ? "Practice session complete" : "No matching questions" }),
        el("p", { className: "small", text: count
          ? `Session review: ${formatCount(sessionGotIt)} marked got it, ${formatCount(sessionReviewed)} sent for another review.`
          : "Adjust the topic, search, or review-queue filter to see questions." }),
        el("button", {
          className: "button button--primary",
          type: "button",
          text: "Start again",
          onClick: () => startDeck({ shuffleCards: shuffled }),
        }),
      ));
      return;
    }
    if (mode === "quiz") {
      renderQuiz(current);
      return;
    }
    const card = el("article", {
      className: `card viva-card${showAnswer ? " is-flipped" : ""}`,
      "aria-label": showAnswer ? "Answer side of flashcard" : "Question side of flashcard",
    });
    card.append(
      el("p", { className: "viva-card__topic", text: current.group }),
      el("div", { className: "viva-card__inner" },
        el("div", { className: "viva-card__face viva-card__front", "aria-hidden": showAnswer },
          el("span", { className: "page-shell__eyebrow", text: "Question" }),
          el("h2", { className: "h2", text: current.question }),
        ),
        el("div", { className: "viva-card__face viva-card__back", "aria-hidden": !showAnswer },
          el("span", { className: "page-shell__eyebrow", text: "Suggested answer" }),
          el("p", { text: current.answer }),
        ),
      ),
      el("div", { className: "viva-card__actions" },
        el("button", {
          className: "button button--secondary",
          type: "button",
          text: showAnswer ? "Show question" : "Reveal answer",
          "aria-expanded": showAnswer,
          onClick: () => { showAnswer = !showAnswer; renderPanel(); },
        }),
      ),
    );
    const seen = Math.min(position + 1, deck.length);
    panel.append(
      progressBar(seen, deck.length),
      card,
      el("div", { className: "cluster viva-navigation" },
        el("button", {
          className: "button button--secondary",
          type: "button",
          text: "Previous",
          disabled: position === 0,
          onClick: () => { position -= 1; showAnswer = false; renderPanel(); },
        }),
        el("button", {
          className: "button button--secondary",
          type: "button",
          text: "Review again",
          onClick: () => mark("review"),
        }),
        el("button", {
          className: "button button--primary",
          type: "button",
          text: "Got it",
          onClick: () => mark("got-it"),
        }),
        el("button", {
          className: "button button--secondary",
          type: "button",
          text: "Next",
          disabled: position >= deck.length - 1,
          onClick: () => { position += 1; showAnswer = false; renderPanel(); },
        }),
      ),
      el("p", { className: "small", text: "Keyboard: Space or Enter reveals the answer · ← / → moves between cards · G marks got it · R sends it for review." }),
    );
  }

  function renderQuiz(current) {
    const answerField = el("textarea", {
      className: "viva-answer-input",
      rows: 4,
      placeholder: "Write a short answer for yourself...",
      "aria-label": "Your short answer",
      disabled: quizRevealed,
      onInput: () => quizDrafts.set(current.id, answerField.value),
    });
    answerField.value = quizDrafts.get(current.id) ?? "";
    const result = el("article", { className: "card stack viva-quiz-result" });
    const revealButton = el("button", {
      className: "button button--primary",
      type: "button",
      text: "Reveal suggested answer",
      disabled: quizRevealed,
      onClick: () => { quizDrafts.set(current.id, answerField.value); quizRevealed = true; renderPanel(); },
    });
    result.append(
      el("p", { className: "viva-card__topic", text: current.group }),
      el("h2", { className: "h2", text: current.question }),
      el("label", { className: "field-label" }, el("span", { text: "Your short answer" }), answerField),
      revealButton,
    );
    if (quizRevealed) {
      result.append(
        el("div", { className: "viva-suggested-answer" },
          el("h3", { className: "h3", text: "Suggested answer" }),
          el("p", { text: current.answer }),
        ),
        el("p", { className: "small", text: "How would you rate your answer?" }),
        el("div", { className: "cluster viva-rating", role: "group", "aria-label": "Self-rate your answer from 1 to 3" },
          ["Needs review", "Nearly there", "Ready"].map((rating, index) => el("button", {
            className: "button button--secondary button--sm",
            type: "button",
            text: `${index + 1} · ${rating}`,
            onClick: () => {
              quizScore += index + 1;
              quizRated += 1;
              mark("got-it", false);
            },
          })),
        ),
      );
    }
    const average = quizRated ? (quizScore / quizRated).toFixed(1) : "—";
    panel.append(
      progressBar(Math.min(position + (quizRevealed ? 1 : 0), deck.length), deck.length),
      result,
      el("p", { className: "small viva-session-score", text: `Self-rated session score: ${average} / 3 · ${formatCount(quizRated)} rated` }),
      el("div", { className: "cluster viva-navigation" },
        el("button", {
          className: "button button--secondary",
          type: "button",
          text: "Previous",
          disabled: position === 0,
          onClick: () => { position -= 1; quizRevealed = false; renderPanel(); },
        }),
        el("button", {
          className: "button button--secondary",
          type: "button",
          text: "Next question",
          disabled: position >= deck.length - 1,
          onClick: () => { position += 1; quizRevealed = false; renderPanel(); },
        }),
      ),
      el("p", { className: "small", text: "Ratings are self-assessments; the app does not compare your response to the suggested answer." }),
    );
  }

  function mark(result, advance = true) {
    const current = deck[position];
    if (!current) return;
    progress[current.id] = result;
    if (result === "got-it") sessionGotIt += 1;
    else {
      sessionReviewed += 1;
      if (!deck.some((item) => item.id === current.id && item.repeat)) {
        deck.push({ ...current, repeat: true });
      }
    }
    saveProgress();
    if (advance) {
      position += 1;
      showAnswer = false;
      quizRevealed = false;
      renderPanel();
    } else {
      position += 1;
      quizRevealed = false;
      renderPanel();
    }
    updateFilterSummary();
  }

  function formatCount(value) {
    return new Intl.NumberFormat().format(value);
  }

  function updateFilterSummary() {
    const filtered = availableItems();
    const reviewCount = items.filter((item) => progress[item.id] === "review").length;
    status.textContent = `${formatCount(filtered.length)} questions match · ${formatCount(reviewCount)} in review queue · ${formatCount(items.length)} saved questions.`;
  }

  const topics = ["All topics", ...new Set(items.map((item) => item.group))];
  const topicChips = el("div", { className: "cluster viva-topics", role: "group", "aria-label": "Filter by topic" });
  topics.forEach((topic) => {
    const chip = el("button", {
      className: `button button--secondary button--sm${topic === selectedTopic ? " is-active" : ""}`,
      type: "button",
      "aria-pressed": topic === selectedTopic,
      text: topic,
      onClick: () => {
        selectedTopic = topic;
        topicChips.querySelectorAll("button").forEach((button) => {
          const selected = button.textContent === topic;
          button.classList.toggle("is-active", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
        startDeck();
        updateFilterSummary();
      },
    });
    topicChips.append(chip);
  });
  const search = el("input", {
    className: "viva-search",
    type: "search",
    placeholder: "Search questions and answers",
    "aria-label": "Search viva questions and answers",
    onInput: () => {
      query = search.value.trim().toLocaleLowerCase();
      startDeck();
      updateFilterSummary();
    },
  });
  const searchLabel = el("label", { className: "field-label viva-search-label" },
    el("span", { text: "Search" }),
    search,
  );
  const reviewToggle = el("input", {
    type: "checkbox",
    onChange: () => {
      reviewOnly = reviewToggle.checked;
      startDeck();
      updateFilterSummary();
    },
  });
  const reviewLabel = el("label", { className: "checkbox-label" },
    reviewToggle,
    el("span", { text: "Review queue only" }),
  );
  const shuffleButton = el("button", {
    className: "button button--secondary button--sm",
    type: "button",
    text: "Shuffle questions",
    onClick: () => startDeck({ shuffleCards: true }),
  });
  const resetButton = el("button", {
    className: "button button--secondary button--sm",
    type: "button",
    text: "Reset progress",
    onClick: () => {
      progress = {};
      saveProgress();
      updateFilterSummary();
      toast("Viva progress reset.");
      startDeck();
    },
  });
  filters.append(
    el("div", { className: "stack" }, el("h2", { className: "h3", text: "Topics" }), topicChips),
    el("div", { className: "viva-filter-row" }, searchLabel, reviewLabel),
    controls,
  );

  ["flashcards", "quiz"].forEach((value) => {
    const button = el("button", {
      className: "segmented__option",
      type: "button",
      "aria-pressed": value === mode,
      text: value === "flashcards" ? "Flashcards" : "Quiz",
      onClick: () => {
        mode = value;
        modeButtons.querySelectorAll("button").forEach((control) =>
          control.setAttribute("aria-pressed", String(control.textContent.toLowerCase() === value)));
        sessionReviewed = 0;
        sessionGotIt = 0;
        quizScore = 0;
        quizRated = 0;
        startDeck({ shuffleCards: shuffled });
      },
    });
    modeButtons.append(button);
  });
  controls.append(
    modeButtons,
    shuffleButton,
    resetButton,
  );
  section.append(filters, status, panel);
  container.replaceChildren(section);
  updateFilterSummary();
  startDeck();

  const keyHandler = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
    if (mode === "quiz") return;
    if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      if (deck[position]) {
        showAnswer = !showAnswer;
        renderPanel();
      }
    } else if (event.key === "ArrowRight" && position < deck.length - 1) {
      position += 1; showAnswer = false; renderPanel();
    } else if (event.key === "ArrowLeft" && position > 0) {
      position -= 1; showAnswer = false; renderPanel();
    } else if (event.key.toLowerCase() === "g") {
      mark("got-it");
    } else if (event.key.toLowerCase() === "r") {
      mark("review");
    }
  };
  document.addEventListener("keydown", keyHandler);
  cleanup.push(() => document.removeEventListener("keydown", keyHandler));
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
}
