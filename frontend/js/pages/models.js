/*
Purpose: Compare the saved candidate models and tuning results.
Inputs: Exported model table, metadata, and target status.
Outputs: A sortable comparison page with chart cleanup.
*/
import { makeBar } from "../charts.js";
import {
  copyToClipboard,
  createTabs,
  el,
  formatNumber,
  toast,
} from "../ui.js";

let cleanup = [];
let activeChart = null;

const targetLinePlugin = {
  id: "study-target-line",
  afterDatasetsDraw(chart, _args, options) {
    const yScale = chart.scales.y;
    const target = Number(options.value);
    if (!yScale || !Number.isFinite(target)) return;
    const y = yScale.getPixelForValue(target);
    const { left, right, top, bottom } = chart.chartArea;
    if (y < top || y > bottom) return;
    const context = chart.ctx;
    context.save();
    context.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--amber").trim();
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 1.5;
    context.setLineDash([6, 5]);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.setLineDash([]);
    context.font = "12px system-ui, sans-serif";
    context.textAlign = "right";
    context.fillText(`R² target ${formatNumber(target, 3)}`, right - 4, y - 6);
    context.restore();
  },
};

const errorBarsPlugin = {
  id: "study-error-bars",
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    const errors = dataset?.errors;
    const meta = chart.getDatasetMeta(0);
    if (!errors || !meta?.data?.length) return;
    const yScale = chart.scales.y;
    const context = chart.ctx;
    context.save();
    context.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--text-dim").trim();
    context.lineWidth = 1.5;
    errors.forEach((error, index) => {
      const point = meta.data[index];
      if (!point || !Number.isFinite(error)) return;
      const x = point.x;
      const yTop = yScale.getPixelForValue(dataset.data[index] + error);
      const yBottom = yScale.getPixelForValue(dataset.data[index] - error);
      context.beginPath();
      context.moveTo(x, yTop);
      context.lineTo(x, yBottom);
      context.moveTo(x - 5, yTop);
      context.lineTo(x + 5, yTop);
      context.moveTo(x - 5, yBottom);
      context.lineTo(x + 5, yBottom);
      context.stroke();
    });
    context.restore();
  },
};

const columns = [
  { key: "Model", label: "Model", kind: "text" },
  { key: "CV_R2_mean", label: "CV R² (mean ± std)", kind: "cv" },
  { key: "Test_MAE", label: "MAE (marks)", kind: "number" },
  { key: "Test_MSE", label: "MSE", kind: "number" },
  { key: "Test_RMSE", label: "RMSE (marks)", kind: "number" },
  { key: "Test_R2", label: "Test R²", kind: "number" },
];

function tableCell(row, column) {
  if (column.kind === "cv") {
    return `${formatNumber(row.CV_R2_mean, 3)} ± ${formatNumber(row.CV_R2_std, 3)}`;
  }
  if (column.kind === "number") {
    const decimals = column.key.endsWith("_R2")
      ? 3
      : column.key.includes("MAE") || column.key.includes("RMSE")
        ? 2
        : 4;
    return formatNumber(row[column.key], decimals);
  }
  return row[column.key];
}

function markdownTable(rows) {
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(tableCell(row, column)).replaceAll("|", "\\|")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function createComparisonTable(rows, selectedModel) {
  const table = el("table", { className: "data-table", "aria-label": "Model comparison" });
  const thead = el("thead");
  const tbody = el("tbody");
  const sort = { key: "CV_R2_mean", descending: true };
  const headerCells = new Map();
  const drawRows = () => {
    const sorted = [...rows].sort((left, right) => {
      const leftValue = left[sort.key];
      const rightValue = right[sort.key];
      const comparison = typeof leftValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return sort.descending ? -comparison : comparison;
    });
    tbody.replaceChildren(...sorted.map((row) => {
      const tr = el("tr", { className: row.Model === selectedModel ? "is-selected" : "" });
      columns.forEach((column) => tr.append(
        el("td", {
          className: column.kind !== "text" ? "is-numeric" : "",
          text: tableCell(row, column),
        }),
      ));
      return tr;
    }));
    columns.forEach((column) => {
      const header = headerCells.get(column.key);
      if (header) header.setAttribute("aria-sort", sort.key === column.key
        ? (sort.descending ? "descending" : "ascending")
        : "none");
    });
  };
  const headerRow = el("tr");
  columns.forEach((column) => {
    const header = el("th", { scope: "col", "aria-sort": "none" });
    const button = el("button", { className: "sort-button", type: "button", text: column.label });
    button.addEventListener("click", () => {
      sort.descending = sort.key === column.key ? !sort.descending : column.kind !== "text";
      sort.key = column.key;
      drawRows();
    });
    header.append(button);
    headerCells.set(column.key, header);
    headerRow.append(header);
  });
  thead.append(headerRow);
  table.append(thead, tbody);
  drawRows();
  return table;
}

function barRow(label, value, maxValue) {
  const width = maxValue > 0 ? Math.max(0, Math.min(100, (value / maxValue) * 100)) : 0;
  return el("div", { className: "model-bar-row" },
    el("div", { className: "cluster model-bar-row__label" },
      el("span", { text: label }),
      el("strong", { className: "num", text: formatNumber(value, 3) }),
    ),
    el("span", { className: "model-bar-row__track", "aria-hidden": "true" },
      el("span", { className: "model-bar-row__fill", style: { "--bar-width": `${width}%` } }),
    ),
  );
}

function chartView(kind, models, meta) {
  const rows = models.final_table;
  const labels = rows.map((row) => row.Model);
  let data;
  let options;
  if (kind === "cv") {
    data = {
      labels,
      datasets: [{
        label: "CV R² mean",
        data: rows.map((row) => row.CV_R2_mean),
        errors: rows.map((row) => row.CV_R2_std),
      }],
    };
    options = {
      title: "Cross-validation R² by model",
      subtitle: "Mean score with standard-deviation error bars",
      xLabel: "Model",
      yLabel: "CV R²",
      tableRows: rows.map((row) => ({
        Model: row.Model,
        "CV R² mean": formatNumber(row.CV_R2_mean, 3),
        "CV R² standard deviation": formatNumber(row.CV_R2_std, 3),
      })),
      scales: { y: { min: -0.1, max: 1, title: { display: true, text: "CV R²" } } },
      plugins: [errorBarsPlugin, targetLinePlugin],
      chartOptions: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(item) {
                return `${item.dataset.label}: ${formatNumber(item.raw, 3)}`;
              },
            },
          },
          "study-target-line": { value: meta.target_r2 },
        },
      },
    };
  } else if (kind === "test") {
    data = {
      labels,
      datasets: [{ label: "Test R²", data: rows.map((row) => row.Test_R2) }],
    };
    options = {
      title: "Held-out test R² by model",
      subtitle: "Held-out test set (20%)",
      xLabel: "Model",
      yLabel: "Test R²",
      tableRows: rows.map((row) => ({ Model: row.Model, "Test R²": formatNumber(row.Test_R2, 3) })),
      scales: { y: { min: -0.1, max: 1, title: { display: true, text: "Test R²" } } },
      plugins: [targetLinePlugin],
      chartOptions: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(item) {
                return `${item.dataset.label}: ${formatNumber(item.raw, 3)}`;
              },
            },
          },
          "study-target-line": { value: meta.target_r2 },
        },
      },
    };
  } else {
    data = {
      labels,
      datasets: [
        { label: "MAE", data: rows.map((row) => row.Test_MAE) },
        { label: "RMSE", data: rows.map((row) => row.Test_RMSE) },
      ],
    };
    options = {
      title: "Held-out error by model",
      subtitle: "Held-out test set (20%) · marks",
      xLabel: "Model",
      yLabel: "Error (marks)",
      tableRows: rows.map((row) => ({
        Model: row.Model,
        "MAE (marks)": formatNumber(row.Test_MAE, 2),
        "RMSE (marks)": formatNumber(row.Test_RMSE, 2),
      })),
      chartOptions: {
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label(item) {
                return `${item.dataset.label}: ${formatNumber(item.raw, 2)} marks`;
              },
            },
          },
        },
      },
    };
  }
  return makeBar(data, options);
}

function createTuningCard(modelName, record) {
  const parameterChips = Object.entries(record.param_grid).flatMap(([key, values]) =>
    values.map((value) => el("span", {
      className: "chip tuning-card__chip",
      text: `${key.replace(/^model__/, "")}: ${value === null ? "None" : String(value)}`,
    })),
  );
  const bestParams = Object.entries(record.best_params).map(([key, value]) =>
    `${key.replace(/^model__/, "")} = ${value === null ? "None" : String(value)}`,
  ).join(" · ");
  const maxValue = Math.max(record.default_cv_r2, record.best_cv_r2, 0);
  return el("details", { className: "tuning-card" },
    el("summary", { className: "tuning-card__summary", text: modelName }),
    el("div", { className: "stack tuning-card__body" },
      el("div", { className: "cluster tuning-card__chips" }, parameterChips),
      el("p", { className: "small", text: `Best parameters: ${bestParams}` }),
      barRow("Default CV R²", record.default_cv_r2, maxValue),
      barRow("Tuned CV R²", record.best_cv_r2, maxValue),
      el("p", {
        className: "small",
        text: Number.isFinite(record.overfit_gap)
          ? `Recorded training-to-CV R² gap: ${formatNumber(record.overfit_gap, 3)}.`
          : "Training-to-CV gap: Not available.",
      }),
    ),
  );
}

export async function render(container, context) {
  destroy();
  const [meta, models] = await Promise.all([
    context.loadJSON("meta.json"),
    context.loadJSON("models.json"),
  ]);
  const section = el("section", { className: "page-shell models-page" });
  const targetStatus = el("article", { className: "card target-status" },
    el("p", { className: "page-shell__eyebrow", text: "Recorded target status" }),
    el("h2", { className: "h3", text: `Test R² = ${formatNumber(meta.final_model.test_r2, 3)} · CV R² = ${formatNumber(meta.final_model.cv_r2, 3)} · target ${formatNumber(meta.target_r2, 2)}` }),
    el("p", {
      className: "target-status__line",
      text: `Test: ${meta.target_met_test ? "met" : "not met"} · CV: ${meta.target_met_cv ? "met" : "not met"}`,
    }),
    el("p", { className: "small", text: meta.cv_vs_test_note }),
  );

  const selectedSummary = el("section", { className: "models-selection callout callout--honesty" },
    el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }),
    el("div", {},
      el("h2", { className: "h3", text: `${models.selected_model} was selected before the test set was opened, using cross-validation.` }),
      el("p", { className: "small", text: models.selection_rule_text }),
    ),
  );
  const comparison = createComparisonTable(models.final_table, models.selected_model);
  const tableSection = el("section", { className: "stack", "aria-labelledby": "models-table-title" },
    el("div", { className: "cluster models-table__toolbar" },
      el("h2", { className: "h2", id: "models-table-title", text: "Candidate comparison" }),
      el("button", {
        className: "button button--secondary button--sm",
        type: "button",
        text: "Copy table as Markdown",
        onClick: async () => {
          try {
            await copyToClipboard(markdownTable(models.final_table));
          } catch (error) {
            console.error(error);
            toast(error instanceof Error ? error.message : "Could not copy the comparison table.");
          }
        },
      }),
    ),
    el("div", { className: "cluster" },
      el("span", { className: "stat-pill", text: "5-fold CV" }),
      el("span", { className: "stat-pill", text: "held-out test set (20%)" }),
    ),
    el("div", { className: "table-wrap" }, comparison),
  );

  const chartHost = el("div", { className: "models-chart" });
  const chartTabsHost = el("div");
  const chartTabs = createTabs(chartTabsHost, [
    { label: "CV R²" },
    { label: "Test R²" },
    { label: "MAE & RMSE" },
  ], (tab, index) => {
    activeChart?.destroy();
    activeChart = chartView(["cv", "test", "error"][index], models, meta);
    chartHost.replaceChildren(activeChart.element);
  });
  cleanup.push(() => chartTabs.destroy());
  activeChart = chartView("cv", models, meta);
  chartHost.append(activeChart.element);

  const tuningCards = Object.entries(models.tuning).map(([modelKey, record]) => {
    const tuningPrefix = modelKey.replace("Regressor", "").toLowerCase();
    const modelName = models.final_table.find((row) => row.Model.toLowerCase().includes(tuningPrefix))?.Model
      ?? modelKey;
    return createTuningCard(modelName, record);
  });
  const tuningSection = el("section", { className: "stack", "aria-labelledby": "tuning-title" },
    el("div", { className: "home-section-heading" },
      el("p", { className: "page-shell__eyebrow", text: "Recorded search results" }),
      el("h2", { className: "h2", id: "tuning-title", text: "Tuning explorer" }),
      el("p", { className: "small", text: "Parameter grids and CV scores are shown exactly as exported." }),
    ),
    el("div", { className: "stack" }, tuningCards),
  );

  const sections = [
    el("p", { className: "page-shell__eyebrow", text: "Model lab" }),
    el("h1", { className: "page-shell__title", text: "Compare the candidates" }),
    el("p", { className: "page-shell__purpose", text: "Cross-validation guided model selection; the held-out test set provides a separate final comparison." }),
    selectedSummary,
    tableSection,
    el("section", { className: "stack", "aria-labelledby": "models-charts-title" },
      el("h2", { className: "h2", id: "models-charts-title", text: "Performance views" }),
      chartTabsHost,
      chartHost,
    ),
    targetStatus,
    tuningSection,
  ];

  const hasTrainingR2 = models.final_table.some((row) =>
    Number.isFinite(row.Train_R2) || Number.isFinite(row.train_r2));
  if (hasTrainingR2) {
    sections.push(el("section", { className: "stack", "aria-labelledby": "overfit-title" },
      el("h2", { className: "h2", id: "overfit-title", text: "Training and CV fit" }),
      el("p", { className: "small", text: "Training and cross-validation R² values recorded by the model export." }),
      el("div", { className: "grid" }, models.final_table.map((row) => {
        const trainR2 = row.Train_R2 ?? row.train_r2;
        return el("article", { className: "card" },
          el("h3", { className: "h3", text: row.Model }),
          barRow("Training R²", trainR2, 1),
          barRow("CV R²", row.CV_R2_mean, 1),
        );
      })),
    ));
  }

  if (models.selected_model === "LinearRegression") {
    sections.push(el("article", { className: "card interpretation-card" },
      el("p", { className: "page-shell__eyebrow", text: "Interpretation, not a measured causal claim" }),
      el("h2", { className: "h2", text: "Why Linear Regression can win" }),
      el("ul", { className: "interpretation-card__list" },
        el("li", { text: "If useful patterns are mostly additive and linear, a linear model can represent them without tree splits." }),
        el("li", { text: `For this project's ${formatNumber(meta.n_rows_clean, 0)} cleaned rows, a compact model is practical to compare and validate.` }),
        el("li", { text: "Its saved coefficients make the fitted behavior easier to inspect and explain." }),
      ),
    ));
  }
  section.replaceChildren(...sections);
  container.replaceChildren(section);
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
  activeChart?.destroy();
  activeChart = null;
}
