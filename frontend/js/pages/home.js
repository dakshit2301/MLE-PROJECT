/*
Purpose: Show the project's headline results and key findings.
Inputs: Saved metadata, model specification, and importance JSON.
Outputs: Home page DOM and a cleaned-up example profile gauge.
*/
import { predict } from "../predictor.js";
import {
  animateNumber,
  el,
  formatNumber,
  observeInView,
} from "../ui.js";

let cleanup = [];
let cycleTimer = 0;

const svgNS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function readableFeature(name) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function makeMiniGauge(presets, reducedMotion) {
  const card = el("article", {
    className: "home-gauge card",
    "aria-label": "Example predictions for the saved student profiles",
    tabindex: "0",
  });
  const svg = svgElement("svg", {
    viewBox: "0 0 220 142",
    role: "img",
    "aria-label": "Semicircle gauge for an example model estimate",
  });
  svg.append(
    svgElement("path", { class: "home-gauge__track", d: "M 26 116 A 84 84 0 0 1 194 116" }),
  );
  const needle = svgElement("line", {
    class: "home-gauge__needle",
    x1: 110,
    y1: 116,
    x2: 110,
    y2: 40,
  });
  svg.append(needle, svgElement("circle", { class: "home-gauge__hub", cx: 110, cy: 116, r: 5 }));
  const value = el("strong", { className: "home-gauge__value num", "aria-live": "polite" });
  const name = el("span", { className: "home-gauge__name" });
  card.append(
    el("div", { className: "home-gauge__heading" },
      el("p", { className: "small", text: "Model estimate · saved profiles" }),
      name,
    ),
    svg,
    value,
    el("span", { className: "small", text: "Predicted Exam_Score" }),
  );

  let index = reducedMotion ? 1 : 0;
  const showPreset = () => {
    const preset = presets[index];
    const score = predict(preset.inputs).clipped;
    const angle = -90 + Math.max(0, Math.min(100, score)) * 1.8;
    needle.style.transform = `rotate(${angle}deg)`;
    value.textContent = formatNumber(score, 1);
    name.textContent = preset.name;
  };
  showPreset();

  const pause = () => {
    window.clearInterval(cycleTimer);
    cycleTimer = 0;
  };
  const resume = () => {
    if (reducedMotion || cycleTimer) return;
    cycleTimer = window.setInterval(() => {
      index = (index + 1) % presets.length;
      showPreset();
    }, 4000);
  };
  card.addEventListener("mouseenter", pause);
  card.addEventListener("mouseleave", resume);
  card.addEventListener("focusin", pause);
  card.addEventListener("focusout", (event) => {
    if (!card.contains(event.relatedTarget)) resume();
  });
  cleanup.push(() => {
    pause();
    card.removeEventListener("mouseenter", pause);
    card.removeEventListener("mouseleave", resume);
  });
  resume();
  return card;
}

function makeMetric({ label, value, decimals = 0, suffix = "", note = "", animate = true }) {
  const card = el("article", { className: "card metric-card home-metric" });
  const output = el("strong", {
    className: "metric-card__value num",
    text: animate ? "—" : String(value),
  });
  card.append(
    el("span", { className: "metric-card__label", text: label }),
    output,
    el("span", { className: "metric-card__unit", text: suffix }),
    el("span", { className: "metric-card__note", text: note }),
  );
  if (animate) {
    cleanup.push(observeInView(card, () => {
      const cancel = animateNumber(output, value, { decimals });
      cleanup.push(cancel);
    }, { threshold: 0.35 }));
  }
  return card;
}

export async function render(container, context) {
  destroy();
  const [meta, modelSpec, importance] = await Promise.all([
    context.loadJSON("meta.json"),
    context.loadJSON("model_spec.json"),
    context.loadJSON("importance.json"),
  ]);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dataset = meta.dataset;
  const section = el("section", { className: "page-shell home-page" });
  const heroCopy = el("div", { className: "home-hero__copy" },
    el("p", { className: "page-shell__eyebrow", text: "College ML PBL · ECSCI24302" }),
    el("h1", { className: "home-hero__title", text: "What predicts an exam score?" }),
    el("p", {
      className: "lead home-hero__lead",
      text: `Explore how ${meta.final_model.name} models Exam_Score across ${formatNumber(meta.n_rows_clean, 0)} cleaned student records.`,
    }),
    el("div", { className: "cluster home-hero__actions" },
      el("a", { className: "button button--primary", href: "#/predict", text: "Try the predictor →" }),
      el("a", { className: "button button--secondary", href: "#/method", text: "See how it was built" }),
    ),
    el("p", {
      className: "small home-hero__note",
      text: "The target is Exam_Score, not CGPA. Stress level and screen time are not in this dataset.",
    }),
  );
  const gauge = makeMiniGauge(modelSpec.presets, reducedMotion);
  const hero = el("div", { className: "home-hero" }, heroCopy, gauge);

  const modelStatus = `CV R² ${formatNumber(meta.final_model.cv_r2, 3)} · target ${formatNumber(meta.target_r2, 2)}: test ${meta.target_met_test ? "met" : "not met"} / CV ${meta.target_met_cv ? "met" : "not met"}`;
  const metrics = el("div", { className: "home-metrics grid" },
    makeMetric({ label: "Students analysed", value: meta.n_rows_clean, decimals: 0, note: `${formatNumber(meta.n_rows_train, 0)} train · ${formatNumber(meta.n_rows_test, 0)} held-out test` }),
    makeMetric({ label: "Final model", value: meta.final_model.name, animate: false, note: "Selected using cross-validation" }),
    makeMetric({ label: "Test R²", value: meta.final_model.test_r2, decimals: 3, note: modelStatus }),
    makeMetric({ label: "Typical error", value: meta.final_model.test_mae, decimals: 2, suffix: "marks", note: "Test MAE · held-out test set (20%)" }),
  );

  const findings = importance.permutation.slice(0, 3);
  const maxImportance = Math.max(...findings.map((item) => Math.max(0, item.mean_decrease_r2)));
  const findingCards = findings.map((item) => {
    const fraction = maxImportance > 0 ? Math.max(0, item.mean_decrease_r2) / maxImportance : 0;
    return el("a", {
      className: "card finding-card",
      href: "#/importance",
      style: { "--finding-width": `${fraction * 100}%` },
      "aria-label": `${readableFeature(item.feature)} is ranked ${formatNumber(item.rank, 0)} in permutation importance. View importance evidence.`,
    },
    el("span", { className: "finding-card__rank", text: formatNumber(item.rank, 0) }),
    el("h3", { className: "h3", text: readableFeature(item.feature) }),
    el("p", { className: "small", text: `${readableFeature(item.feature)} ranked ${formatNumber(item.rank, 0)} in permutation importance for this dataset.` }),
    el("span", { className: "finding-card__bar", "aria-hidden": "true" },
      el("span", { className: "finding-card__fill" }),
    ),
    el("span", { className: "small finding-card__link", text: "See importance evidence →" }));
  });
  const datasetChip = el("div", { className: "dataset-credit card" },
    el("div", {},
      el("span", { className: "stat-pill", text: `Dataset · ${dataset.name}` }),
      el("p", { className: "small", text: `Source: ${dataset.source} · URL: ${dataset.url} · License: ${dataset.license}` }),
    ),
  );

  section.append(
    hero,
    metrics,
    el("div", { className: "callout callout--honesty home-honesty" },
      el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }),
      el("p", {
        className: "callout__text",
        text: "This model targets Exam_Score, not CGPA. Stress level and screen time are not in this dataset. Correlation is not prediction, and prediction is not causation.",
      }),
    ),
    el("section", { className: "home-findings", "aria-labelledby": "home-findings-title" },
      el("div", { className: "home-section-heading" },
        el("p", { className: "page-shell__eyebrow", text: "Evidence from the fitted project" }),
        el("h2", { className: "h2", id: "home-findings-title", text: "Where the model found signal" }),
        el("p", { className: "small", text: "Permutation importance measures predictive value in this dataset; it does not explain real-world outcomes." }),
      ),
      el("div", { className: "home-findings__grid grid" }, findingCards),
    ),
    datasetChip,
  );
  container.replaceChildren(section);
}

export function destroy() {
  window.clearInterval(cycleTimer);
  cycleTimer = 0;
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
}
