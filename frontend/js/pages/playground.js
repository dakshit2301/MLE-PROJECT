/*
Purpose: Let visitors explore predictions from the saved model.
Inputs: Model metadata, feature values, and local predictor helpers.
Outputs: An interactive prediction page with disposable UI resources.
*/
import { makeLine } from "../charts.js";
import {
  copyToClipboard,
  createSegmented,
  el,
  formatNumber,
  toast,
} from "../ui.js";
import { describeInputIssues, predict, sweep } from "../predictor.js";

let cleanup = [];
let charts = [];
let frame = 0;
let announceTimer = 0;
let gaugeFrame = 0;
let lastAnnouncement = 0;

const svgNS = "http://www.w3.org/2000/svg";
const unknownFeatures = new Set([
  "Teacher_Quality",
  "Parental_Education_Level",
  "Distance_from_Home",
]);
const numericUnits = {
  Hours_Studied: "hours per week",
  Attendance: "percent attendance",
  Sleep_Hours: "hours per night",
  Previous_Scores: "marks",
  Physical_Activity: "days per week",
};
const featureGroups = [
  { label: "Study habits", names: new Set(["Hours_Studied", "Attendance", "Tutoring_Sessions"]) },
  { label: "Lifestyle", names: new Set(["Sleep_Hours", "Physical_Activity", "Extracurricular_Activities"]) },
  { label: "Support & environment", names: new Set([
    "Parental_Involvement",
    "Access_to_Resources",
    "Motivation_Level",
    "Family_Income",
    "Teacher_Quality",
    "Peer_Influence",
    "Parental_Education_Level",
    "Distance_from_Home",
    "Internet_Access",
  ]) },
  { label: "Background", names: new Set(["Previous_Scores", "School_Type", "Learning_Disabilities", "Gender"]) },
];
const queryKeys = {
  Hours_Studied: "h",
  Attendance: "a",
  Sleep_Hours: "s",
  Previous_Scores: "p",
  Tutoring_Sessions: "t",
  Physical_Activity: "pa",
  Parental_Involvement: "pi",
  Access_to_Resources: "ar",
  Motivation_Level: "ml",
  Family_Income: "fi",
  Teacher_Quality: "tq",
  Peer_Influence: "peer",
  Parental_Education_Level: "pe",
  Distance_from_Home: "d",
  Extracurricular_Activities: "ex",
  Internet_Access: "ia",
  School_Type: "st",
  Learning_Disabilities: "ld",
  Gender: "g",
};

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rangeValueText(feature, value) {
  const number = Number(value);
  const display = formatNumber(number, Number.isInteger(number) ? 0 : 1);
  if (feature.name === "Tutoring_Sessions") {
    return `${display} tutoring session${Math.abs(number) === 1 ? "" : "s"}`;
  }
  return `${display} ${numericUnits[feature.name] ?? feature.label}`;
}

function typicalInputs(modelSpec) {
  return Object.fromEntries(modelSpec.features_used.map((feature) => [
    feature.name,
    feature.kind === "numeric"
      ? feature.median
      : modelSpec.imputation_modes[feature.name] ?? modelSpec.categorical[feature.name].mode,
  ]));
}

function normalizeInputs(candidate, modelSpec, fallback = typicalInputs(modelSpec)) {
  const inputs = { ...fallback };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return inputs;
  for (const feature of modelSpec.features_used) {
    if (!Object.hasOwn(candidate, feature.name)) continue;
    const value = candidate[feature.name];
    if (feature.kind === "numeric") {
      const number = Number(value);
      if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER) inputs[feature.name] = number;
    } else if (
      (value === null && unknownFeatures.has(feature.name))
      || modelSpec.categorical[feature.name].order.includes(value)
    ) {
      inputs[feature.name] = value;
    }
  }
  return inputs;
}

function isValidProfile(candidate, modelSpec) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  return modelSpec.features_used.every((feature) => {
    if (!Object.hasOwn(candidate, feature.name)) return false;
    const value = candidate[feature.name];
    if (feature.kind === "numeric") {
      return Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER;
    }
    return (value === null && unknownFeatures.has(feature.name))
      || modelSpec.categorical[feature.name].order.includes(value);
  });
}

function readHashState(modelSpec) {
  const queryStart = window.location.hash.indexOf("?");
  if (queryStart < 0) return { inputs: typicalInputs(modelSpec), scenarios: [] };
  const params = new URLSearchParams(window.location.hash.slice(queryStart + 1));
  const candidate = {};
  for (const feature of modelSpec.features_used) {
    const key = queryKeys[feature.name];
    if (!key || !params.has(key)) continue;
    const value = params.get(key);
    if (feature.kind === "numeric") {
      if (value !== "") candidate[feature.name] = Number(value);
    } else if (value === "" && unknownFeatures.has(feature.name)) {
      candidate[feature.name] = null;
    } else if (value !== "") {
      candidate[feature.name] = value;
    }
  }
  let scenarios = [];
  try {
    const decoded = JSON.parse(params.get("sc") ?? "[]");
    if (Array.isArray(decoded)) {
      scenarios = decoded.slice(0, 3).flatMap((scenario, index) => {
        if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) return [];
        if (!isValidProfile(scenario.inputs, modelSpec)) return [];
        const inputs = normalizeInputs(scenario.inputs, modelSpec);
        return [{
          name: typeof scenario.name === "string" ? scenario.name : `Scenario ${formatNumber(index + 1, 0)}`,
          inputs,
        }];
      });
    }
  } catch {
    scenarios = [];
  }
  return { inputs: normalizeInputs(candidate, modelSpec), scenarios };
}

function writeHashState(inputs, scenarios, modelSpec) {
  const params = new URLSearchParams();
  modelSpec.features_used.forEach((feature) => {
    const key = queryKeys[feature.name];
    if (key) params.set(key, inputs[feature.name] === null ? "" : String(inputs[feature.name]));
  });
  if (scenarios.length) params.set("sc", JSON.stringify(scenarios));
  const nextHash = `#/predict?${params.toString()}`;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${nextHash}`,
  );
}

function cleanLabel(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inputValueText(feature, value) {
  if (value === null || value === undefined) return "Unknown · model uses the most common answer";
  return feature.kind === "numeric" ? formatNumber(value, 1) : String(value);
}

function groupFeatures(features) {
  return featureGroups.map((group) => ({
    label: group.label,
    features: features.filter((feature) => group.names.has(feature.name)),
  })).filter((group) => group.features.length);
}

function arcPath(startFraction, endFraction, radius = 78) {
  const start = clamp(startFraction, 0, 1);
  const end = clamp(endFraction, 0, 1);
  if (end <= start) return "";
  const angle = (fraction) => Math.PI - Math.PI * fraction;
  const point = (fraction) => ({
    x: 100 + radius * Math.cos(angle(fraction)),
    y: 100 - radius * Math.sin(angle(fraction)),
  });
  const first = point(start);
  const last = point(end);
  const largeArc = end - start > 0.5 ? 1 : 0;
  return `M ${first.x} ${first.y} A ${radius} ${radius} 0 ${largeArc} 1 ${last.x} ${last.y}`;
}

function makeGauge(targetStats, uncertainty) {
  const svg = svgElement("svg", {
    class: "prediction-gauge__svg",
    viewBox: "0 0 200 126",
    role: "img",
    "aria-label": "Predicted exam score on a semicircle with MAE and RMSE bands",
  });
  const track = svgElement("path", { class: "prediction-gauge__track" });
  const rmseBand = svgElement("path", { class: "prediction-gauge__band prediction-gauge__band--rmse" });
  const maeBand = svgElement("path", { class: "prediction-gauge__band prediction-gauge__band--mae" });
  const needle = svgElement("line", {
    class: "prediction-gauge__needle",
    x1: 100,
    y1: 100,
    x2: 100,
    y2: 24,
  });
  const hub = svgElement("circle", { class: "prediction-gauge__hub", cx: 100, cy: 100, r: 5 });
  const minLabel = svgElement("text", { class: "prediction-gauge__tick", x: 17, y: 119, "text-anchor": "start" });
  const maxLabel = svgElement("text", { class: "prediction-gauge__tick", x: 183, y: 119, "text-anchor": "end" });
  svg.append(track, rmseBand, maeBand, needle, hub, minLabel, maxLabel);

  let fullScale = false;
  let previousAngle = 0;
  const scale = () => fullScale ? [0, 100] : [targetStats.min, targetStats.max];
  const draw = (result) => {
    const [min, max] = scale();
    const span = max - min || 1;
    const fraction = (value) => clamp((value - min) / span, 0, 1);
    track.setAttribute("d", arcPath(0, 1));
    rmseBand.setAttribute("d", arcPath(
      fraction(result.clipped - uncertainty.rmse),
      fraction(result.clipped + uncertainty.rmse),
    ));
    maeBand.setAttribute("d", arcPath(
      fraction(result.clipped - uncertainty.mae),
      fraction(result.clipped + uncertainty.mae),
    ));
    minLabel.textContent = formatNumber(min, 0);
    maxLabel.textContent = formatNumber(max, 0);
    const targetAngle = Math.PI - Math.PI * fraction(result.clipped);
    const targetX = 100 + 70 * Math.cos(targetAngle);
    const targetY = 100 - 70 * Math.sin(targetAngle);
    const from = previousAngle;
    const to = Math.atan2(100 - targetY, targetX - 100);
    previousAngle = to;
    window.cancelAnimationFrame(gaugeFrame);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      needle.setAttribute("x2", String(targetX));
      needle.setAttribute("y2", String(targetY));
      return;
    }
    const started = performance.now();
    const duration = 280;
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const finalEase = 1 - Math.exp(-6) * Math.cos(10);
      const eased = (1 - Math.exp(-6 * progress) * Math.cos(10 * progress)
        + Math.exp(-6) * Math.cos(10)) / finalEase;
      const angle = from + (to - from) * eased;
      needle.setAttribute("x2", String(100 + 70 * Math.cos(angle)));
      needle.setAttribute("y2", String(100 - 70 * Math.sin(angle)));
      if (progress < 1) gaugeFrame = window.requestAnimationFrame(tick);
      else {
        needle.setAttribute("x2", String(targetX));
        needle.setAttribute("y2", String(targetY));
      }
    };
    gaugeFrame = window.requestAnimationFrame(tick);
  };
  return {
    element: svg,
    draw,
    toggleScale() {
      fullScale = !fullScale;
    },
  };
}

function buildTrainingHistogram(eda, testPoints, meta) {
  const histogram = eda.numeric_hist.Exam_Score;
  const counts = [...histogram.counts];
  const edges = histogram.bin_edges;
  let valid = counts.reduce((sum, count) => sum + count, 0) === meta.n_rows_clean
    && testPoints.actual.length === meta.n_rows_test;
  if (valid) {
    testPoints.actual.forEach((score) => {
      let index = edges.findIndex((edge, edgeIndex) =>
        edgeIndex < edges.length - 1 && score >= edge && score < edges[edgeIndex + 1]);
      if (score === edges.at(-1)) index = counts.length - 1;
      if (index < 0 || counts[index] <= 0) valid = false;
      else counts[index] -= 1;
    });
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!valid || total !== meta.n_rows_train || counts.some((count) => count < 0)) {
    return {
      counts: histogram.counts,
      edges,
      total: histogram.counts.reduce((sum, count) => sum + count, 0),
      label: "Cleaned dataset Exam_Score distribution",
    };
  }
  return { counts, edges, total, label: "Training Exam_Score distribution" };
}

function scorePercentile(score, histogram) {
  let below = 0;
  for (let index = 0; index < histogram.counts.length; index += 1) {
    const left = histogram.edges[index];
    const right = histogram.edges[index + 1];
    const count = histogram.counts[index];
    if (score >= right) below += count;
    else if (score > left) {
      below += count * ((score - left) / (right - left));
      break;
    } else break;
  }
  return histogram.total ? clamp((below / histogram.total) * 100, 0, 100) : null;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function render(container, context) {
  destroy();
  const [meta, modelSpec, eda, testPoints] = await Promise.all([
    context.loadJSON("meta.json"),
    context.loadJSON("model_spec.json"),
    context.loadJSON("eda.json"),
    context.loadJSON("test_points.json"),
  ]);
  let inputs = readHashState(modelSpec).inputs;
  let scenarios = readHashState(modelSpec).scenarios;
  const controls = new Map();
  const numericFeatures = modelSpec.features_used.filter((feature) => feature.kind === "numeric");
  const trainingHistogram = buildTrainingHistogram(eda, testPoints, meta);

  const section = el("section", { className: "page-shell playground-page" },
    el("p", { className: "page-shell__eyebrow", text: "Interactive model · Path A" }),
    el("h1", { className: "page-shell__title", text: "Explore a model estimate" }),
    el("p", { className: "page-shell__purpose", text: "Change a profile to see how the fitted Linear Regression responds. This is model behavior, not a real exam outcome." }),
  );
  const layout = el("div", { className: "playground-layout" });
  const controlsPanel = el("div", { className: "playground-controls" });
  const resultsPanel = el("div", { className: "playground-results-column" });

  const presets = el("div", { className: "card preset-card" },
    el("h2", { className: "h3", text: "Start with a saved profile" }),
    el("p", { className: "small", text: "Presets are demonstration profiles from the exported model specification." }),
  );
  const presetActions = el("div", { className: "cluster preset-card__actions" });

  const updateRangeVisuals = (feature, range, number, output, value, warning) => {
    const numeric = Number(value);
    const span = feature.max - feature.min || 1;
    const bounded = clamp(numeric, feature.min, feature.max);
    const outside = numeric < feature.min || numeric > feature.max;
    range.value = String(bounded);
    range.setAttribute("aria-valuetext", rangeValueText(feature, numeric));
    number.value = String(numeric);
    number.setAttribute("aria-invalid", String(outside));
    output.textContent = formatNumber(numeric, Number.isInteger(numeric) ? 0 : 1);
    range.style.setProperty("--range-progress", `${((bounded - feature.min) / span) * 100}%`);
    warning.hidden = !outside;
  };

  const onInputChange = () => schedulePrediction();
  const makeNumericControl = (feature) => {
    const id = `input-${feature.name}`;
    const wrapper = el("div", { className: "playground-control range-control" });
    const label = el("label", { className: "range-control__label", for: id, text: feature.label });
    const output = el("output", { className: "range-control__value", for: id });
    const range = el("input", {
      className: "range-control__input",
      id,
      type: "range",
      min: String(feature.min),
      max: String(feature.max),
      step: String(feature.step ?? 1),
      "aria-label": feature.label,
    });
    const number = el("input", {
      className: "range-control__number",
      type: "number",
      min: String(feature.min),
      max: String(feature.max),
      step: String(feature.step ?? 1),
      "aria-label": `${feature.label} exact value`,
    });
    const rangeWarning = el("span", {
      className: "range-control__warning",
      role: "status",
      text: `${feature.label} is outside the range the model saw; prediction less reliable.`,
      hidden: true,
    });
    const span = feature.max - feature.min || 1;
    const medianPosition = ((feature.median - feature.min) / span) * 100;
    const limits = el("div", {
      className: "range-control__limits",
      style: { "--median-position": `${medianPosition}%` },
    },
      el("span", { text: formatNumber(feature.min, 0) }),
      el("span", { className: "range-control__median", "aria-hidden": "true" }),
      el("span", { text: formatNumber(feature.max, 0) }),
    );
    const reset = el("button", {
      className: "range-control__reset",
      type: "button",
      text: "Reset to typical",
      onClick: () => {
        inputs[feature.name] = feature.median;
        updateRangeVisuals(feature, range, number, output, inputs[feature.name], rangeWarning);
        onInputChange();
      },
    });
    range.addEventListener("input", () => {
      inputs[feature.name] = Number(range.value);
      updateRangeVisuals(feature, range, number, output, inputs[feature.name], rangeWarning);
      onInputChange();
    });
    number.addEventListener("input", () => {
      const value = Number(number.value);
      if (!Number.isFinite(value)) return;
      inputs[feature.name] = value;
      updateRangeVisuals(feature, range, number, output, value, rangeWarning);
      onInputChange();
    });
    wrapper.append(
      el("div", { className: "range-control__top" }, label, output),
      range,
      el("div", { className: "range-control__bottom" }, limits, number),
      rangeWarning,
      reset,
    );
    updateRangeVisuals(feature, range, number, output, inputs[feature.name], rangeWarning);
    controls.set(feature.name, { feature, range, number, output, warning: rangeWarning });
    return wrapper;
  };

  const makeCategoryControl = (feature) => {
    const options = modelSpec.categorical[feature.name].order;
    const host = el("div", { className: "playground-control category-control" });
    host.append(
      el("span", { className: "range-control__label", text: feature.label }),
    );
    const group = el("div", {
      className: "chip-group",
      role: "radiogroup",
      "aria-label": feature.label,
    });
    const values = [...options, ...(unknownFeatures.has(feature.name) ? [null] : [])];
    const buttons = [];
    const select = (value, focus = false) => {
      inputs[feature.name] = value;
      buttons.forEach((button, index) => {
        const selected = values[index] === value;
        button.setAttribute("aria-checked", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      if (focus) buttons[values.indexOf(value)]?.focus();
      onInputChange();
    };
    values.forEach((value, index) => {
      const button = el("button", {
        className: value === null ? "chip chip--unknown" : "chip",
        type: "button",
        role: "radio",
        "aria-checked": value === inputs[feature.name],
        tabindex: value === inputs[feature.name] ? "0" : "-1",
        text: value === null
          ? "Unknown (model uses the most common answer)"
          : value,
      });
      button.addEventListener("click", () => select(value));
      button.addEventListener("keydown", (event) => {
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else return;
        event.preventDefault();
        select(values[next], true);
      });
      buttons.push(button);
      group.append(button);
    });
    host.append(group);
    controls.set(feature.name, { feature, group, buttons });
    return host;
  };

  groupFeatures(modelSpec.features_used).forEach((group) => {
    const fieldset = el("fieldset", { className: "playground-group" },
      el("legend", { className: "h3", text: group.label }),
    );
    group.features.forEach((feature) => fieldset.append(
      feature.kind === "numeric" ? makeNumericControl(feature) : makeCategoryControl(feature),
    ));
    controlsPanel.append(fieldset);
  });

  const unusedFeatures = el("details", { className: "unused-features card" },
    el("summary", { text: "Features not used by the final model" }),
    el("p", { className: "small", text: "These engineered features were dropped during feature selection on training data." }),
    el("ul", { className: "chip-list" }, modelSpec.features_not_used.map((feature) =>
      el("li", { className: "chip", text: cleanLabel(feature) }))),
  );
  presets.append(presetActions);
  modelSpec.presets.forEach((preset) => {
    presetActions.append(el("button", {
      className: "button button--secondary button--sm",
      type: "button",
      text: preset.name,
      title: preset.description,
      onClick: () => applyPreset(preset.inputs),
    }));
  });
  presetActions.append(el("button", {
    className: "button button--ghost button--sm",
    type: "button",
    text: "Reset to typical student",
    onClick: () => applyPreset(typicalInputs(modelSpec)),
  }));
  controlsPanel.prepend(presets);
  controlsPanel.append(unusedFeatures);

  const predictionDock = el("details", { className: "prediction-dock" });
  const compactScore = el("strong", { className: "num prediction-dock__compact-score" });
  const compactSummary = el("summary", { className: "prediction-dock__summary" },
    el("span", { text: "Predicted exam score" }),
    compactScore,
    el("span", { className: "prediction-dock__expand", text: "Details" }),
  );
  const resultContent = el("div", { className: "prediction-dock__content" });
  const score = el("strong", { className: "prediction-gauge__score num" });
  const announcement = el("span", { className: "visually-hidden", role: "status", "aria-live": "polite" });
  const gauge = makeGauge(meta.target_stats, modelSpec.uncertainty);
  const scaleToggle = el("button", {
    className: "button button--ghost button--sm",
    type: "button",
    text: `Show full 0–100 scale`,
    onClick: () => {
      gauge.toggleScale();
      scaleToggle.textContent = scaleToggle.textContent.includes("full")
        ? `Show observed ${formatNumber(meta.target_stats.min, 0)}–${formatNumber(meta.target_stats.max, 0)} scale`
        : "Show full 0–100 scale";
      updatePrediction();
    },
  });
  const gaugeCard = el("section", { className: "card prediction-gauge", "aria-labelledby": "prediction-title" },
    el("div", { className: "cluster prediction-gauge__heading" },
      el("div", {},
        el("h2", { className: "h3", id: "prediction-title", text: "Predicted exam score" }),
        el("p", { className: "small", text: `${meta.final_model.name} · target ${meta.target}` }),
      ),
      scaleToggle,
    ),
    gauge.element,
    score,
    el("p", { className: "small", text: "Model estimate · 0–100 output display" }),
    el("div", { className: "prediction-gauge__legend" },
      el("span", { className: "prediction-legend__item prediction-legend__item--mae", text: `± test MAE · ${formatNumber(modelSpec.uncertainty.mae, 2)} marks` }),
      el("span", { className: "prediction-legend__item prediction-legend__item--rmse", text: `± test RMSE · ${formatNumber(modelSpec.uncertainty.rmse, 2)} marks` }),
    ),
    el("p", { className: "small prediction-gauge__error-copy", text: `Typical error: about ${formatNumber(modelSpec.uncertainty.mae, 2)} marks. Nine in ten predictions on the held-out set were within ${formatNumber(modelSpec.uncertainty.p90_abs_error, 2)} marks.` }),
  );
  const rawNote = el("p", { className: "small prediction-raw-note", hidden: true });
  const warningList = el("div", { className: "stack prediction-warnings" });

  const histogramHost = el("section", { className: "card context-card", "aria-label": trainingHistogram.label });
  const histogramBars = el("div", { className: "score-histogram", role: "img", "aria-label": trainingHistogram.label });
  const barElements = trainingHistogram.counts.map((count, index) => el("span", {
    className: "score-histogram__bin",
    style: { "--hist-height": `${trainingHistogram.counts.length ? (count / Math.max(...trainingHistogram.counts)) * 100 : 0}%` },
    "aria-label": `${formatNumber(trainingHistogram.edges[index], 1)} to ${formatNumber(trainingHistogram.edges[index + 1], 1)}: ${formatNumber(count, 0)} students`,
  }));
  const scoreMarker = el("span", { className: "score-histogram__marker", "aria-hidden": "true" });
  histogramBars.append(...barElements, scoreMarker);
  const percentile = el("p", { className: "small context-card__percentile" });
  histogramHost.append(
    el("h3", { className: "h3", text: trainingHistogram.label }),
    el("p", { className: "small", text: `${formatNumber(trainingHistogram.total, 0)} training rows · score bins from exported EDA data` }),
    histogramBars,
    percentile,
  );

  const contributionHost = el("section", { className: "card contribution-card", "aria-labelledby": "contribution-title" });
  const contributionList = el("div", { className: "stack contribution-list" });
  const contributionToggle = el("button", { className: "button button--ghost button--sm", type: "button" });
  contributionHost.append(
    el("h3", { className: "h3", id: "contribution-title", text: "How this model assembles the estimate" }),
    el("p", { className: "small", text: "Coefficient-weighted differences from the typical student profile describe the fitted model, not real-world effects." }),
    contributionList,
    contributionToggle,
  );

  const sweepFeatureHost = el("div", { className: "sweep-feature-control" });
  const sweepChartHost = el("div", { className: "sweep-chart" });
  const sweepCaption = el("p", { className: "small sweep-caption", text: "This shows how the model's prediction changes when only one input changes. It does not prove that changing a habit would change a real exam score." });
  const numericSweep = createSegmented(sweepFeatureHost, {
    label: "Feature to vary",
    items: numericFeatures.map((feature) => ({ label: feature.label, name: feature.name })),
  }, (choice) => {
    selectedSweep = numericFeatures.find((feature) => feature.name === choice.name) ?? numericFeatures[0];
    updateSweepChart();
  });
  cleanup.push(() => numericSweep.destroy());
  let selectedSweep = numericFeatures[0];
  const sweepSteps = (feature) => {
    const count = 25;
    return Array.from({ length: count }, (_, index) =>
      feature.min + ((feature.max - feature.min) * index) / (count - 1));
  };
  const initialSweepValues = sweepSteps(selectedSweep);
  const initialSweepScores = sweep(inputs, selectedSweep.name, initialSweepValues)
    .map((result) => result.clipped);
  let sweepChart = makeLine({
    labels: initialSweepValues.map((value) => formatNumber(value, 1)),
    datasets: [
      { label: "Model estimate", data: initialSweepScores, pointRadius: 0, tension: 0.25 },
      { label: "Current input", data: initialSweepScores.map((value, index) =>
        index === 0 ? value : null), showLine: false, pointRadius: 6 },
    ],
  }, {
    title: "What-if model sweep",
    subtitle: "Other inputs held at their current values",
    xLabel: selectedSweep.label,
    yLabel: "Predicted Exam_Score",
    tableRows: initialSweepValues.map((value, index) => ({
      [selectedSweep.label]: value,
      "Predicted Exam_Score": initialSweepScores[index],
    })),
  });
  charts.push(sweepChart);
  sweepChartHost.append(sweepChart.element);
  const scenarioHost = el("section", { className: "card scenario-card", "aria-labelledby": "scenario-title" });
  const scenarioTableHost = el("div", { className: "table-wrap scenario-table-wrap" });
  const scenarioActions = el("div", { className: "cluster scenario-card__actions" });
  const saveScenario = el("button", { className: "button button--primary button--sm", type: "button", text: "Save scenario" });
  const clearScenarios = el("button", { className: "button button--ghost button--sm", type: "button", text: "Clear", disabled: scenarios.length === 0 });
  const copyLink = el("button", { className: "button button--secondary button--sm", type: "button", text: "Copy link" });
  const downloadCsv = el("button", { className: "button button--secondary button--sm", type: "button", text: "Download CSV", disabled: scenarios.length === 0 });
  scenarioActions.append(saveScenario, clearScenarios, copyLink, downloadCsv);
  scenarioHost.append(
    el("h3", { className: "h3", id: "scenario-title", text: "Compare saved scenarios" }),
    el("p", { className: "small", text: "Save up to three profiles. Shared links include the current profile and saved scenarios." }),
    scenarioActions,
    scenarioTableHost,
  );

  const honesty = el("div", { className: "callout callout--honesty playground-honesty" },
    el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }),
    el("p", { className: "callout__text", text: "Model estimate from a college dataset — not a prediction of your real exam result and not study advice." }),
  );
  resultContent.append(
    gaugeCard,
    announcement,
    rawNote,
    warningList,
    histogramHost,
    contributionHost,
    el("section", { className: "card sweep-card", "aria-labelledby": "sweep-title" },
      el("h3", { className: "h3", id: "sweep-title", text: "What-if sweep" }),
      el("p", { className: "small", text: "Choose one numeric input to vary across its observed training range." }),
      sweepFeatureHost,
      sweepChartHost,
      sweepCaption,
    ),
    scenarioHost,
  );
  predictionDock.append(compactSummary, resultContent);
  resultsPanel.append(predictionDock);
  layout.append(controlsPanel, resultsPanel);
  section.append(honesty, layout);
  container.replaceChildren(section);

  function updateWarnings(result) {
    const warnings = [...result.warnings];
    modelSpec.features_used.filter((feature) =>
      feature.kind === "categorical" && inputs[feature.name] === null,
    ).forEach((feature) => warnings.push(
      `${feature.label} is unknown; the model uses its most common training answer.`,
    ));
    warningList.replaceChildren(...warnings.map((message) =>
      el("div", { className: "callout callout--honesty prediction-warning" },
        el("span", { className: "callout__icon", text: "!", "aria-hidden": "true" }),
        el("p", { className: "callout__text", text: message }),
      )));
  }

  function updateContributions() {
    const contributions = modelSpec.features_used.map((feature) => {
      const coefficientName = `${feature.kind === "numeric" ? "num" : "ord"}__${feature.name}`;
      const coefficient = modelSpec.coefficients.values[coefficientName];
      let delta;
      if (feature.kind === "numeric") {
        const index = modelSpec.scaler.columns.indexOf(feature.name);
        delta = (Number(inputs[feature.name]) - Number(feature.median))
          / modelSpec.scaler.scale[index];
      } else {
        const order = modelSpec.categorical[feature.name].order;
        const current = inputs[feature.name] ?? modelSpec.imputation_modes[feature.name];
        const typical = modelSpec.imputation_modes[feature.name];
        delta = order.indexOf(current) - order.indexOf(typical);
      }
      return { feature, value: coefficient * delta };
    }).filter((item) => Number.isFinite(item.value))
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
    const maximum = Math.max(0, ...contributions.map((item) => Math.abs(item.value)));
    const showAll = contributionToggle.getAttribute("aria-expanded") === "true";
    const visible = showAll ? contributions : contributions.slice(0, 6);
    contributionList.replaceChildren(...visible.map(({ feature, value }) => {
      const width = maximum ? (Math.abs(value) / maximum) * 50 : 0;
      return el("div", { className: `contribution-row${value < 0 ? " is-negative" : " is-positive"}` },
        el("div", { className: "cluster contribution-row__top" },
          el("span", { text: feature.label }),
          el("strong", { className: "num", text: `${value >= 0 ? "+" : ""}${formatNumber(value, 3)}` }),
        ),
        el("span", { className: "contribution-row__track", "aria-hidden": "true" },
          el("span", { className: "contribution-row__bar", style: { "--contribution-width": `${width}%` } }),
        ),
      );
    }));
    contributionToggle.textContent = showAll ? "Show top six" : "Show all features";
    contributionToggle.setAttribute("aria-expanded", String(showAll));
  }

  function updateScenarioTable() {
    clearScenarios.disabled = scenarios.length === 0;
    downloadCsv.disabled = scenarios.length === 0;
    saveScenario.disabled = scenarios.length >= 3;
    if (!scenarios.length) {
      scenarioTableHost.replaceChildren(el("p", { className: "small", text: "No scenarios saved yet." }));
      return;
    }
    const header = el("thead", {}, el("tr", {},
      el("th", { scope: "col", text: "Profile" }),
      ...scenarios.map((scenario) => el("th", { scope: "col", text: scenario.name })),
    ));
    const body = el("tbody");
    const predictions = scenarios.map((scenario) => predict(scenario.inputs).clipped);
    const rows = [
      ["Predicted exam score", ...predictions.map((value) => formatNumber(value, 1))],
      ["Delta vs first", ...predictions.map((value, index) =>
        `${value - predictions[0] >= 0 ? "+" : ""}${formatNumber(value - predictions[0], 1)}`)],
      ...numericFeatures.map((feature) => [
        feature.label,
        ...scenarios.map((scenario) => formatNumber(scenario.inputs[feature.name], 1)),
      ]),
    ];
    rows.forEach(([label, ...values]) => body.append(el("tr", {},
      el("th", { scope: "row", text: label }),
      ...values.map((value) => el("td", { className: "is-numeric", text: value })),
    )));
    const table = el("table", { className: "data-table", "aria-label": "Saved scenario comparison" }, header, body);
    scenarioTableHost.replaceChildren(table);
  }

  function updateSweepChart() {
    if (!sweepChart) return;
    const values = sweepSteps(selectedSweep);
    const results = sweep(inputs, selectedSweep.name, values);
    const predictions = results.map((result) => result.clipped);
    const currentIndex = values.reduce((best, value, index) =>
      Math.abs(value - inputs[selectedSweep.name]) < Math.abs(values[best] - inputs[selectedSweep.name])
        ? index
        : best, 0);
    const data = {
      labels: values.map((value) => formatNumber(value, Number.isInteger(value) ? 0 : 1)),
      datasets: [
        { label: "Model estimate", data: predictions, pointRadius: 0, tension: 0.25 },
        { label: "Current input", data: predictions.map((value, index) =>
          index === currentIndex ? value : null), showLine: false, pointRadius: 6 },
      ],
    };
    sweepChart.update(data, values.map((value, index) => ({
      [selectedSweep.label]: value,
      "Predicted Exam_Score": predictions[index],
    })));
    sweepChart.element.querySelector(".chart-frame__title").textContent = `What-if: ${selectedSweep.label}`;
    sweepChart.element.querySelector(".chart-frame__subtitle").textContent = "Other inputs held at their current values";
    sweepChart.element.querySelector(".chart-frame__table table").setAttribute("aria-label", `What-if sweep for ${selectedSweep.label}`);
  }

  function updateContextBar(result) {
    const [min, max] = [trainingHistogram.edges[0], trainingHistogram.edges.at(-1)];
    const percent = max > min ? clamp(((result.clipped - min) / (max - min)) * 100, 0, 100) : 0;
    scoreMarker.style.left = `${percent}%`;
    const percentileValue = scorePercentile(result.clipped, trainingHistogram);
    percentile.textContent = percentileValue === null
      ? "Relative position is not available."
      : `Higher than about ${formatNumber(percentileValue, 0)}% of students in the training data.`;
  }

  function updatePrediction() {
    try {
      const result = predict(inputs);
      if (!Number.isFinite(result.raw) || !Number.isFinite(result.clipped)) {
        throw new RangeError("The model returned a non-finite estimate for these inputs.");
      }
      score.textContent = formatNumber(result.clipped, 1);
      compactScore.textContent = formatNumber(result.clipped, 1);
      gauge.draw(result);
      rawNote.hidden = result.raw >= 0 && result.raw <= 100;
      rawNote.textContent = "The raw model estimate is outside 0–100; the displayed estimate is clipped to that range.";
      updateWarnings(result);
      updateContextBar(result);
      updateContributions();
      updateSweepChart();
      const now = performance.now();
      if (now - lastAnnouncement >= 600) {
        announcement.textContent = `Predicted exam score ${formatNumber(result.clipped, 1)}.`;
        lastAnnouncement = now;
      } else {
        window.clearTimeout(announceTimer);
        announceTimer = window.setTimeout(() => {
          announcement.textContent = `Predicted exam score ${formatNumber(result.clipped, 1)}.`;
          lastAnnouncement = performance.now();
        }, 600 - (now - lastAnnouncement));
      }
      writeHashState(inputs, scenarios, modelSpec);
      return result;
    } catch (error) {
      console.error(error);
      const recoveryHint = modelSpec.path === "B"
        ? "For Path B, start the local service with python server.py."
        : "Check the local frontend data files and reload the page.";
      warningList.replaceChildren(el("div", { className: "callout callout--warning", role: "alert" },
        el("span", { className: "callout__icon", text: "!", "aria-hidden": "true" }),
        el("p", { className: "callout__text", text: error instanceof Error ? error.message : "The model could not estimate this profile." }),
        el("code", { className: "empty-state__hint", text: recoveryHint }),
      ));
      return null;
    }
  }

  function schedulePrediction() {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      updatePrediction();
    });
  }

  function syncControls() {
    controls.forEach(({ feature, range, number, output, warning, buttons }) => {
      if (feature.kind === "numeric") {
        updateRangeVisuals(feature, range, number, output, inputs[feature.name], warning);
      } else {
        buttons.forEach((button, index) => {
          const value = index === feature.options?.length ? null : button.textContent;
          const matches = value === inputs[feature.name]
            || (button.classList.contains("chip--unknown") && inputs[feature.name] === null);
          button.setAttribute("aria-checked", String(matches));
          button.tabIndex = matches ? 0 : -1;
        });
      }
    });
  }

  function applyPreset(profile) {
    const target = normalizeInputs(profile, modelSpec);
    const start = { ...inputs };
    const started = performance.now();
    const duration = 300;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.cancelAnimationFrame(frame);
    frame = 0;
    const animate = (now) => {
      const progress = reducedMotion ? 1 : Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      modelSpec.features_used.forEach((feature) => {
        if (feature.kind === "numeric") {
          inputs[feature.name] = start[feature.name]
            + (target[feature.name] - start[feature.name]) * eased;
        } else if (progress === 1) {
          inputs[feature.name] = target[feature.name];
        }
      });
      syncControls();
      updatePrediction();
      if (progress < 1) frame = window.requestAnimationFrame(animate);
      else frame = 0;
    };
    frame = window.requestAnimationFrame(animate);
  }

  function saveCurrentScenario() {
    if (scenarios.length >= 3) return;
    const copy = { ...inputs };
    const result = predict(copy);
    scenarios.push({
      name: `Scenario ${formatNumber(scenarios.length + 1, 0)}`,
      inputs: copy,
      prediction: result.clipped,
    });
    updateScenarioTable();
    writeHashState(inputs, scenarios, modelSpec);
  }

  function downloadScenarios() {
    if (!scenarios.length) return;
    const headers = ["Scenario", "Predicted Exam_Score", ...modelSpec.features_used.map((feature) => feature.name)];
    const lines = [
      `# Model: ${modelSpec.model_name}; date: ${new Date().toISOString().slice(0, 10)}`,
      headers.map(csvCell).join(","),
      ...scenarios.map((scenario) => [
        scenario.name,
        predict(scenario.inputs).clipped,
        ...modelSpec.features_used.map((feature) => scenario.inputs[feature.name]),
      ].map(csvCell).join(",")),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: "study-lab-scenarios.csv" });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  saveScenario.addEventListener("click", saveCurrentScenario);
  clearScenarios.addEventListener("click", () => {
    scenarios = [];
    updateScenarioTable();
    writeHashState(inputs, scenarios, modelSpec);
  });
  copyLink.addEventListener("click", async () => {
    try {
      await copyToClipboard(window.location.href);
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : "Could not copy the share link.");
    }
  });
  downloadCsv.addEventListener("click", downloadScenarios);
  contributionToggle.addEventListener("click", () => {
    contributionToggle.setAttribute(
      "aria-expanded",
      String(contributionToggle.getAttribute("aria-expanded") !== "true"),
    );
    updateContributions();
  });

  const mobileQuery = window.matchMedia("(max-width: 819px)");
  const syncDock = () => { predictionDock.open = !mobileQuery.matches; };
  mobileQuery.addEventListener("change", syncDock);
  cleanup.push(() => mobileQuery.removeEventListener("change", syncDock));
  syncDock();
  updateScenarioTable();
  updatePrediction();
}

export function destroy() {
  window.cancelAnimationFrame(frame);
  window.cancelAnimationFrame(gaugeFrame);
  window.clearTimeout(announceTimer);
  frame = 0;
  gaugeFrame = 0;
  announceTimer = 0;
  cleanup.forEach((dispose) => dispose());
  charts.forEach((chart) => chart.destroy());
  cleanup = [];
  charts = [];
}
