/*
Purpose: Preview shared UI components on a development-only route.
Inputs: Shared components and sample component configuration.
Outputs: A component gallery hidden from normal navigation.
*/
import {
  createSegmented,
  createTabs,
  el,
  formatNumber,
  toast,
  tooltip,
} from "../ui.js";
import { makeBar, makeHeatmap } from "../charts.js";

let cleanup = [];
let charts = [];

export async function render(container, context) {
  destroy();
  const [meta, modelSpec, models, correlations] = await Promise.all([
    context.loadJSON("meta.json"),
    context.loadJSON("model_spec.json"),
    context.loadJSON("models.json"),
    context.loadJSON("correlations.json"),
  ]);
  const section = el("section", { className: "page-shell" });
  section.append(
    el("p", { className: "page-shell__eyebrow", text: "Developer preview" }),
    el("h1", { className: "page-shell__title", text: "Component gallery" }),
    el("p", { className: "page-shell__purpose", text: "Interactive examples of the shared shell components. Use the theme control to inspect both palettes." }),
  );
  const grid = el("div", { className: "gallery-grid" });
  section.append(grid);

  const addItem = (title, content) => {
    const item = el("section", { className: "gallery-item", "aria-label": title });
    item.append(el("h2", { className: "gallery-item__title", text: title }), content);
    grid.append(item);
  };

  const actions = el("div", { className: "cluster" },
    el("button", { className: "button button--primary", type: "button", text: "Primary", onClick: () => toast("Primary button pressed.") }),
    el("button", { className: "button button--secondary button--sm", type: "button", text: "Secondary", onClick: () => toast("Secondary button pressed.") }),
    el("button", { className: "button button--ghost", type: "button", text: "Ghost", onClick: () => toast("Ghost button pressed.") }),
    el("button", { className: "button button--secondary", type: "button", disabled: true, text: "Disabled" }),
  );
  const loading = el("button", {
    className: "button button--primary is-loading",
    type: "button",
    disabled: true,
    "aria-busy": "true",
  }, el("span", { className: "button__spinner", "aria-hidden": "true" }), "Loading");
  actions.append(loading);
  addItem("Buttons", actions);

  const metric = el("article", { className: "card metric-card" },
    el("span", { className: "metric-card__label", text: "Model fit" }),
    el("strong", { className: "metric-card__value", text: formatNumber(meta.final_model.test_r2, 4) }),
    el("span", { className: "metric-card__unit", text: "test R²" }),
    el("span", { className: "metric-card__note", text: "Held-out test set (20%)" }),
  );
  addItem("Metric card", metric);

  const segmentedHost = el("div");
  const segmented = createSegmented(
    segmentedHost,
    { label: "Chart display", items: [{ label: "Bars" }, { label: "Lines" }, { label: "Dots" }] },
    (choice) => toast(`Selected ${choice.label}`),
  );
  cleanup.push(() => segmented.destroy());
  addItem("Segmented control", segmentedHost);

  const range = el("div", { className: "range-control" });
  const rangeId = "gallery-range";
  const studyFeature = modelSpec.features_used.find((feature) => feature.name === "Hours_Studied");
  const rangeLabel = el("label", { className: "range-control__label", for: rangeId, text: studyFeature.label });
  const rangeValue = el("output", { className: "range-control__value", for: rangeId, text: String(studyFeature.median) });
  const rangeInput = el("input", {
    className: "range-control__input",
    type: "range",
    id: rangeId,
    min: String(studyFeature.min),
    max: String(studyFeature.max),
    value: String(studyFeature.median),
    "aria-label": studyFeature.label,
  });
  const updateRange = () => {
    const ratio = (Number(rangeInput.value) - Number(rangeInput.min))
      / (Number(rangeInput.max) - Number(rangeInput.min));
    rangeValue.value = rangeInput.value;
    rangeInput.style.setProperty("--range-progress", `${ratio * 100}%`);
  };
  rangeInput.addEventListener("input", updateRange);
  range.append(
    el("div", { className: "range-control__top" }, rangeLabel, rangeValue),
    rangeInput,
    el("div", { className: "range-control__limits" }, el("span", { text: String(studyFeature.min) }), el("span", { text: String(studyFeature.max) })),
    el("button", { className: "range-control__reset", type: "button", text: "Reset to median", onClick: () => { rangeInput.value = String(studyFeature.median); updateRange(); } }),
  );
  updateRange();
  addItem("Range slider", range);

  const chips = el("div", { className: "chip-group", role: "radiogroup", "aria-label": "Motivation level" });
  ["Low", "Medium", "High"].forEach((label, index) => {
    const chip = el("button", {
      className: "chip",
      type: "button",
      role: "radio",
      "aria-checked": index === 1,
      tabindex: index === 1 ? "0" : "-1",
      text: label,
    });
    chip.addEventListener("click", () => {
      chips.querySelectorAll('[role="radio"]').forEach((item) => {
        const selected = item === chip;
        item.setAttribute("aria-checked", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
    });
    chip.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const items = [...chips.querySelectorAll('[role="radio"]')];
      const current = items.indexOf(chip);
      const next = items[(current + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
      next.click();
      next.focus();
      event.preventDefault();
    });
    chips.append(chip);
  });
  addItem("Category chips", chips);

  const callouts = el("div", { className: "stack" },
    el("div", { className: "callout" }, el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }), el("p", { className: "callout__text", text: "Information callout with a data accent." })),
    el("div", { className: "callout callout--honesty" }, el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }), el("p", { className: "callout__text", text: "Honesty callout with an amber marker." })),
    el("div", { className: "callout callout--warning" }, el("span", { className: "callout__icon", text: "!", "aria-hidden": "true" }), el("p", { className: "callout__text", text: "Warning callout uses readable text and a rose border." })),
  );
  addItem("Callouts", callouts);

  const sortableRows = [...models.final_table];
  sortableRows.sort((left, right) => right.Test_R2 - left.Test_R2);
  const sortableTable = el("table", { className: "data-table", "aria-label": "Model comparison example" });
  const modelHeader = el("th", { scope: "col", "aria-sort": "none" }, el("button", { className: "sort-button", type: "button", text: "Model" }));
  const scoreHeader = el("th", { scope: "col", className: "is-numeric", "aria-sort": "descending" }, el("button", { className: "sort-button", type: "button", "aria-pressed": "true", text: "Test R²" }));
  const sortableBody = el("tbody");
  const drawModelRows = () => {
    sortableBody.replaceChildren(...sortableRows.map((row) => el("tr", {},
      el("td", { text: row.Model }),
      el("td", { className: "is-numeric", text: formatNumber(row.Test_R2, 4) }),
    )));
  };
  let sortKey = "Test_R2";
  let sortDescending = true;
  const sortRows = (key, header) => {
    if (sortKey === key) sortDescending = !sortDescending;
    else {
      sortKey = key;
      sortDescending = false;
    }
    sortableRows.sort((left, right) => {
      const comparison = typeof left[key] === "number"
        ? left[key] - right[key]
        : String(left[key]).localeCompare(String(right[key]));
      return sortDescending ? -comparison : comparison;
    });
    modelHeader.setAttribute("aria-sort", key === "Model" ? (sortDescending ? "descending" : "ascending") : "none");
    scoreHeader.setAttribute("aria-sort", key === "Test_R2" ? (sortDescending ? "descending" : "ascending") : "none");
    modelHeader.querySelector("button").setAttribute("aria-pressed", String(key === "Model"));
    scoreHeader.querySelector("button").setAttribute("aria-pressed", String(key === "Test_R2"));
    drawModelRows();
  };
  modelHeader.querySelector("button").addEventListener("click", () => sortRows("Model", modelHeader));
  scoreHeader.querySelector("button").addEventListener("click", () => sortRows("Test_R2", scoreHeader));
  sortableTable.append(
    el("thead", {}, el("tr", {}, modelHeader, scoreHeader)),
    sortableBody,
  );
  drawModelRows();
  addItem("Sortable table", el("div", { className: "table-wrap" }, sortableTable));

  const tabHost = el("div");
  const tabContent = el("p", { className: "small", text: "Bars view selected." });
  const tabset = el("div", { className: "stack" }, tabHost, tabContent);
  const tabs = createTabs(tabHost, [{ label: "Bars" }, { label: "Points" }, { label: "Notes" }], (tab) => {
    tabContent.textContent = `${tab.label} view selected.`;
  });
  cleanup.push(() => tabs.destroy());
  addItem("Arrow-key tabs", tabset);

  const tooltipHost = el("div", { className: "gallery-card" });
  const tooltipTrigger = el("button", { className: "tooltip-trigger", type: "button", text: "What does test R² mean?" });
  tooltipHost.append(tooltipTrigger);
  cleanup.push(tooltip(tooltipTrigger, "The proportion of score variance explained on the held-out test set."));
  addItem("Tooltip", tooltipHost);

  const toastHost = el("button", {
    className: "button button--secondary",
    type: "button",
    text: "Show toast",
    onClick: () => toast("This is a polite, temporary notification."),
  });
  addItem("Toast", toastHost);

  addItem("Skeletons", el("div", { className: "skeleton-stack gallery-card", "aria-label": "Loading examples" },
    el("div", { className: "skeleton skeleton--title", "aria-hidden": "true" }),
    el("div", { className: "skeleton skeleton--wide", "aria-hidden": "true" }),
    el("div", { className: "skeleton skeleton--block", "aria-hidden": "true" }),
  ));
  addItem("Stat pill", el("span", { className: "stat-pill", text: "held-out test set (20%)" }));

  const empty = el("div", { className: "empty-state" },
    el("span", { className: "empty-state__icon", text: "∅", "aria-hidden": "true" }),
    el("h3", { className: "h3", text: "No rows to show" }),
    el("p", { className: "small", text: "Regenerate the frontend JSON if source data is unavailable." }),
    el("code", { className: "empty-state__hint", text: "python export_data.py" }),
  );
  addItem("Empty state", empty);

  const chartSlot = el("div");
  const barChart = makeBar(
    {
      labels: models.final_table.map((row) => row.Model),
      datasets: [{ label: "Test R²", data: models.final_table.map((row) => row.Test_R2) }],
    },
    {
      title: "Chart frame",
      xLabel: "Model",
      yLabel: "Test R²",
      subtitle: "Final comparison table",
      tableRows: models.final_table.map((row) => ({ Model: row.Model, "Test R²": row.Test_R2 })),
    },
  );
  chartSlot.append(barChart.element);
  charts.push(barChart);
  addItem("Chart with data-table toggle", chartSlot);

  const heatmapSize = Math.min(5, correlations.matrix.labels.length);
  const heatmap = makeHeatmap(
    {
      labels: correlations.matrix.labels.slice(0, heatmapSize),
      values: correlations.matrix.values.slice(0, heatmapSize).map((row) => row.slice(0, heatmapSize)),
    },
    { title: "Accessible heatmap", xLabel: "Feature", yLabel: "Feature" },
  );
  charts.push(heatmap);
  addItem("SVG heatmap", heatmap.element);

  container.replaceChildren(section);
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  charts.forEach((chart) => chart.destroy());
  cleanup = [];
  charts = [];
}
