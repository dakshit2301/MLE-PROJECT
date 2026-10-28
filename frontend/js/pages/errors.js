/*
Purpose: Inspect held-out predictions and model error patterns.
Inputs: Exported error summaries and test-point arrays.
Outputs: Filterable charts, error tables, and interaction cleanup.
*/
import { makeBar, makeHistogram, makeScatter } from "../charts.js";
import { createTabs, el, formatNumber } from "../ui.js";

let cleanup = [];
let charts = [];

function metric(label, value, note) {
  return el("article", { className: "card metric-card fe04-metric" },
    el("span", { className: "metric-card__label", text: label }),
    el("strong", { className: "metric-card__value num", text: value }),
    el("span", { className: "metric-card__note", text: note }),
  );
}

function residualZeroLine() {
  return {
    id: "residual-zero-line",
    afterDraw(chart) {
      const scale = chart.scales.y;
      if (!scale) return;
      const y = scale.getPixelForValue(0);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--amber").trim();
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, y);
      ctx.lineTo(chart.chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    },
  };
}

function identityLine() {
  return {
    id: "actual-predicted-identity",
    afterDatasetsDraw(chart) {
      const x = chart.scales.x;
      const y = chart.scales.y;
      if (!x || !y) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-dim").trim();
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(x.getPixelForValue(x.min), y.getPixelForValue(x.min));
      ctx.lineTo(x.getPixelForValue(x.max), y.getPixelForValue(x.max));
      ctx.stroke();
      ctx.restore();
    },
  };
}

function makeTable(rows, columns, label, onRowClick) {
  const table = el("table", { className: "data-table", "aria-label": label });
  const head = el("thead", {}, el("tr", {}, columns.map((column) =>
    el("th", { scope: "col", text: column.label }))));
  const body = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr", { className: onRowClick ? "is-interactive" : "" });
    columns.forEach((column) => {
      const value = row[column.key];
      const cell = el("td", {
        className: typeof value === "number" ? "is-numeric" : "",
        text: value === null || value === undefined ? "Not available"
          : value === false ? "—"
          : typeof value === "number" ? formatNumber(value, column.decimals ?? 3) : String(value),
      });
      if (column.key === "flag" && value) {
        cell.replaceChildren(el("span", { className: "stat-pill stat-pill--warning", text: "Above rule" }));
      }
      tr.append(cell);
    });
    if (onRowClick) {
      tr.tabIndex = 0;
      tr.addEventListener("click", () => onRowClick(row));
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onRowClick(row);
        }
      });
    }
    body.append(tr);
  });
  table.append(head, body);
  return table;
}

export async function render(container, context) {
  destroy();
  const [errors, points] = await Promise.all([
    context.loadJSON("errors.json"),
    context.loadJSON("test_points.json"),
  ]);
  const summary = errors.summary;
  const section = el("section", { className: "page-shell fe04-page errors-page" },
    el("p", { className: "page-shell__eyebrow", text: "Held-out evaluation" }),
    el("h1", { className: "page-shell__title", text: "Where estimates differ" }),
    el("p", { className: "page-shell__purpose", text: "Describe errors on the held-out test set; these records are evaluation data, not live observations." }),
  );
  const metrics = el("div", { className: "grid fe04-metrics" },
    metric("Mean residual bias", formatNumber(summary.mean_residual_bias, 4), "Actual − predicted; negative means estimates were higher on average"),
    metric("Mean absolute error", `${formatNumber(summary.test_mae, 2)} marks`, "Held-out test set (20%)"),
    metric("Root mean squared error", `${formatNumber(summary.test_rmse, 2)} marks`, "Held-out test set (20%)"),
    metric("90th percentile absolute error", `${formatNumber(summary.p90_absolute_error, 4)} marks`, "Held-out test set (20%)"),
    metric("Maximum absolute error", `${formatNumber(summary.max_absolute_error, 3)} marks`, "Largest held-out difference"),
    metric("Squared error from 10 largest misses", `${formatNumber(summary.top10_squared_error_share_pct, 2)}%`, "A few large misses can dominate R² because residuals are squared"),
  );
  const actual = points.actual;
  const predicted = points.predicted;
  const residual = points.residual;
  const minActual = Math.min(...actual);
  const maxActual = Math.max(...actual);
  let threshold = minActual;
  let colorByError = false;
  let selectedIndex = null;
  let currentScatter = null;
  const pointCard = el("article", { className: "card stack pinned-point", "aria-live": "polite" });
  const scatterHost = el("div");
  const actualSlider = el("input", {
    type: "range",
    min: String(minActual),
    max: String(maxActual),
    step: "1",
    value: String(minActual),
    "aria-label": "Minimum actual exam score to show",
    onInput: () => { threshold = Number(actualSlider.value); updateScatter(); },
  });
  const thresholdLabel = el("span", { className: "stat-pill", "aria-live": "polite" });
  const colorToggle = el("input", {
    type: "checkbox",
    id: "errors-color-toggle",
    onChange: () => { colorByError = colorToggle.checked; updateScatter(); },
  });
  const colorLabel = el("label", { className: "checkbox-label", for: "errors-color-toggle" },
    colorToggle,
    el("span", { text: "Color points by absolute error" }),
  );
  const pinPoint = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= actual.length) return;
    selectedIndex = index;
    const details = [
      ["Actual", actual[index]],
      ["Predicted", predicted[index]],
      ["Residual (actual − predicted)", residual[index]],
      ["Attendance", points.Attendance[index]],
      ["Hours studied", points.Hours_Studied[index]],
      ["Previous scores", points.Previous_Scores[index]],
      ["Motivation level", points.Motivation_Level[index]],
    ];
    pointCard.replaceChildren(
      el("h3", { className: "h3", text: `This student · test row ${formatNumber(index + 1, 0)}` }),
      el("dl", { className: "pinned-point__facts" }, details.flatMap(([name, value]) => [
        el("dt", { text: name }),
        el("dd", { className: typeof value === "number" ? "num" : "", text: typeof value === "number" ? formatNumber(value, 3) : String(value) }),
      ])),
    );
    const chart = globalThis.Chart?.getChart(scatterHost.querySelector("canvas"));
    if (chart) {
      const visibleIndices = chart.data.datasets[0].data.map((item) => item.index);
      const position = visibleIndices.indexOf(index);
      if (position >= 0) {
        chart.setActiveElements([{ datasetIndex: 0, index: position }]);
        chart.tooltip?.setActiveElements([{ datasetIndex: 0, index: position }], { x: 0, y: 0 });
        chart.update();
      }
    }
  };
  function updateScatter() {
    thresholdLabel.textContent = `Showing students with actual ≥ ${formatNumber(threshold, 0)} · ${formatNumber(actual.filter((value) => value >= threshold).length, 0)} rows`;
    const rows = actual.flatMap((value, index) => value < threshold ? [] : [{
      x: value,
      y: predicted[index],
      index,
      absoluteError: Math.abs(residual[index]),
    }]);
    const maximumError = Math.max(...rows.map((row) => row.absoluteError), 0.001);
    const dataset = {
      label: "Held-out students",
      data: rows,
      pointRadius: 3,
      pointHoverRadius: 6,
      backgroundColor: colorByError
        ? (ctx) => {
          const error = ctx.raw?.absoluteError ?? 0;
          const ratio = error / maximumError;
          const low = getComputedStyle(document.documentElement).getPropertyValue("--series-4").trim();
          const high = getComputedStyle(document.documentElement).getPropertyValue("--rose").trim();
          const highPercent = Math.round(Math.min(1, ratio) * 100);
          return `color-mix(in srgb, ${low} ${100 - highPercent}%, ${high} ${highPercent}%)`;
        }
        : getComputedStyle(document.documentElement).getPropertyValue("--series-4").trim(),
    };
    const data = { datasets: [dataset] };
    const options = {
      title: "Actual versus predicted exam score",
      subtitle: points.label,
      xLabel: "Actual Exam_Score",
      yLabel: "Predicted Exam_Score",
      tableRows: rows.slice(0, 120).map((row) => ({
        Actual: row.x,
        Predicted: row.y,
        Residual: residual[row.index],
        Attendance: points.Attendance[row.index],
        "Hours studied": points.Hours_Studied[row.index],
        "Previous scores": points.Previous_Scores[row.index],
        "Motivation level": points.Motivation_Level[row.index],
      })),
      plugins: [identityLine()],
      scales: {
        x: { min: minActual, max: maxActual, title: { display: true, text: "Actual Exam_Score" } },
        y: { min: minActual, max: maxActual, title: { display: true, text: "Predicted Exam_Score" } },
      },
      chartOptions: {
        onClick(_event, elements) {
          if (elements.length) pinPoint(rows[elements[0].index]?.index);
        },
        plugins: {
          tooltip: {
            callbacks: {
              label(item) {
                const row = item.raw;
                const index = row.index;
                return [
                  `Actual: ${formatNumber(actual[index], 2)}`,
                  `Predicted: ${formatNumber(predicted[index], 2)}`,
                  `Residual: ${formatNumber(residual[index], 2)}`,
                  `Attendance: ${formatNumber(points.Attendance[index], 0)}`,
                  `Hours studied: ${formatNumber(points.Hours_Studied[index], 0)}`,
                  `Previous score: ${formatNumber(points.Previous_Scores[index], 0)}`,
                  `Motivation: ${points.Motivation_Level[index]}`,
                ];
              },
            },
          },
        },
      },
    };
    currentScatter?.destroy();
    currentScatter = makeScatter(data, options);
    charts[0] = currentScatter;
    scatterHost.replaceChildren(currentScatter.element);
    if (selectedIndex !== null) pinPoint(selectedIndex);
  }
  updateScatter();
  const actualVsPredicted = el("section", { className: "card stack", id: "actual-predicted-section" },
    el("div", { className: "cluster errors-section-heading" },
      el("div", {}, el("h2", { className: "h2", text: "Actual versus predicted" }),
        el("p", { className: "small", text: "The dashed line marks equal actual and predicted values." })),
      el("span", { className: "stat-pill", text: `${points.label} · ${formatNumber(actual.length, 0)} held-out rows` }),
    ),
    el("div", { className: "cluster errors-controls" },
      el("label", { className: "field-label" }, el("span", { text: "Filter by actual score" }), actualSlider),
      thresholdLabel,
      colorLabel,
      el("span", { className: "small error-color-legend", text: "Color key: lower absolute error · higher absolute error" }),
    ),
    el("div", { className: "errors-scatter-layout" }, scatterHost, pointCard),
  );

  const residualHost = el("div");
  let residualMode = "histogram";
  const residualToggle = el("button", {
    className: "button button--secondary button--sm",
    type: "button",
    text: "Show residual versus predicted",
    "aria-pressed": "false",
    onClick: () => {
      residualMode = residualMode === "histogram" ? "scatter" : "histogram";
      residualToggle.textContent = residualMode === "histogram" ? "Show residual versus predicted" : "Show residual histogram";
      residualToggle.setAttribute("aria-pressed", String(residualMode === "scatter"));
      drawResidual();
    },
  });
  function drawResidual() {
    charts[1]?.destroy();
    if (residualMode === "histogram") {
      const bins = errors.histogram;
      const labels = bins.counts.map((_, index) =>
        `${formatNumber(bins.bin_edges[index], 1)}–${formatNumber(bins.bin_edges[index + 1], 1)}`);
      const chart = makeHistogram({
        labels,
        datasets: [{ label: "Students", data: bins.counts }],
      }, {
        title: "Residual distribution",
        subtitle: "Residual = actual − predicted",
        xLabel: "Residual (marks)",
        yLabel: "Student count",
        tableRows: bins.counts.map((count, index) => ({
          "Residual interval": labels[index],
          Students: count,
        })),
      });
      charts[1] = chart;
      residualHost.replaceChildren(chart.element);
    } else {
      const chart = makeScatter({
        datasets: [{
          label: "Held-out test residual",
          data: predicted.map((value, index) => ({ x: value, y: residual[index] })),
          pointRadius: 2,
        }],
      }, {
        title: "Residual versus predicted score",
        subtitle: points.label,
        xLabel: "Predicted Exam_Score",
        yLabel: "Residual (actual − predicted)",
        tableRows: predicted.slice(0, 120).map((value, index) => ({
          "Predicted Exam_Score": value,
          Residual: residual[index],
        })),
        plugins: [residualZeroLine()],
      });
      charts[1] = chart;
      residualHost.replaceChildren(chart.element);
    }
  }
  drawResidual();
  const residualSection = el("section", { className: "card stack" },
    el("div", { className: "cluster errors-section-heading" },
      el("h2", { className: "h2", text: "Residuals" }),
      residualToggle,
    ),
    el("p", { className: "small", text: "Sign convention: positive residual means the model predicted too low; negative means it predicted too high." }),
    residualHost,
  );

  const errorRangesHost = el("div");
  const errorChartHost = el("div");
  const tabHost = el("div");
  const rangeSets = [
    { label: "By actual score range", key: "by_actual_range", groups: false },
    { label: "By predicted range", key: "by_predicted_range", groups: false },
    { label: "By group", key: "by_group", groups: true },
  ];
  function renderErrorBreakdown(tab) {
    const records = errors[tab.key];
    const groupRecords = tab.groups;
    const rows = records.map((item) => {
      const count = item.count ?? item.n;
      const mae = item.mae;
      const flag = groupRecords && count >= 50 && mae > summary.test_mae * 1.2;
      return {
        group: groupRecords ? `${item.category}: ${item.group}` : item.range,
        n: count,
        mae,
        bias: item.mean_residual ?? null,
        flag,
      };
    });
    const table = makeTable(rows, [
      { key: "group", label: groupRecords ? "Group" : "Score range" },
      { key: "n", label: "Students", decimals: 0 },
      { key: "mae", label: "MAE (marks)", decimals: 2 },
      { key: "bias", label: "Mean residual", decimals: 4 },
      { key: "flag", label: "Rule flag" },
    ], `${tab.label} error summary`);
    const chart = makeBar({
      labels: rows.map((row) => row.group),
      datasets: [
        { label: "MAE (marks)", data: rows.map((row) => row.mae) },
        { label: "Mean residual (marks)", data: rows.map((row) => row.bias) },
      ],
    }, {
      title: `${tab.label} error profile`,
      subtitle: groupRecords
        ? "Mean residual is not available for these exported groups"
        : "Held-out test errors by score band",
      xLabel: "MAE / mean residual (marks)",
      yLabel: groupRecords ? "Group" : "Score range",
      tableRows: rows.map((row) => ({
        Group: row.group,
        "MAE (marks)": formatNumber(row.mae, 2),
        "Mean residual (marks)": row.bias === null ? "Not available" : formatNumber(row.bias, 4),
        Students: formatNumber(row.n, 0),
      })),
      chartOptions: {
        indexAxis: "y",
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label(item) {
                return `${item.dataset.label}: ${formatNumber(item.raw, 2)}`;
              },
            },
          },
        },
      },
    });
    charts[2]?.destroy();
    charts[2] = chart;
    errorRangesHost.replaceChildren(
      el("p", { className: "small", text: groupRecords
        ? `Flag rule: MAE > ${formatNumber(summary.test_mae * 1.2, 2)} marks (20% above overall MAE ${formatNumber(summary.test_mae, 2)}) and n ≥ 50. Mean residual is not included for groups in the export.`
        : "Mean residual uses actual − predicted; positive values indicate underestimation." }),
      el("div", { className: "table-wrap" }, table),
      errorChartHost,
    );
    errorChartHost.replaceChildren(chart.element);
  }
  const breakdownTabs = createTabs(tabHost, rangeSets, (_tab, index) => renderErrorBreakdown(rangeSets[index]));
  cleanup.push(() => breakdownTabs.destroy());
  renderErrorBreakdown(rangeSets[0]);
  const breakdown = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "Where errors are larger" }),
    tabHost,
    errorRangesHost,
  );

  const largestErrors = [...errors.largest_errors];
  let sortKey = "abs_error";
  let descending = true;
  const largestTableHost = el("div");
  const renderLargestTable = () => {
    const sorted = [...largestErrors].sort((a, b) =>
      (descending ? -1 : 1) * (Number(a[sortKey]) - Number(b[sortKey])));
    const rows = sorted.map((row) => ({
      index: row.row_index_in_test,
      actual: row.actual,
      predicted: row.predicted,
      residual: row.residual,
      abs_error: row.abs_error,
      attendance: row.features.Attendance,
      hours: row.features.Hours_Studied,
      previous: row.features.Previous_Scores,
      motivation: row.features.Motivation_Level,
    }));
    const columns = [
      { key: "actual", label: "Actual", decimals: 1 },
      { key: "predicted", label: "Predicted", decimals: 2 },
      { key: "residual", label: "Residual", decimals: 2 },
      { key: "abs_error", label: "Absolute error", decimals: 2 },
      { key: "attendance", label: "Attendance", decimals: 0 },
      { key: "hours", label: "Hours studied", decimals: 0 },
      { key: "previous", label: "Previous score", decimals: 0 },
      { key: "motivation", label: "Motivation" },
    ];
    const table = makeTable(rows, columns, "Largest held-out errors; select a row to pin it in the scatter plot", (row) => {
      threshold = Math.min(threshold, row.actual);
      actualSlider.value = String(threshold);
      updateScatter();
      pinPoint(row.index);
      document.getElementById("actual-predicted-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    table.querySelectorAll("thead th").forEach((th, index) => {
      const column = columns[index];
      if (!column || !["actual", "predicted", "residual", "abs_error"].includes(column.key)) return;
      const button = el("button", {
        className: "sort-button",
        type: "button",
        text: column.label,
        "aria-label": `Sort by ${column.label}`,
        onClick: () => {
          descending = sortKey === column.key ? !descending : true;
          sortKey = column.key;
          renderLargestTable();
        },
      });
      th.replaceChildren(button);
    });
    largestTableHost.replaceChildren(el("div", { className: "table-wrap" }, table));
  };
  renderLargestTable();
  const largestSection = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "Largest errors" }),
    el("p", { className: "small", text: `The exported top ${formatNumber(largestErrors.length, 0)} held-out rows. Select a row to pin its point in the scatter plot.` }),
    largestTableHost,
  );

  const outlierBand = errors.by_actual_range.find((item) => item.range === "80+");
  const interpretation = el("section", { className: "card stack interpretation-card" },
    el("p", { className: "page-shell__eyebrow", text: "Data-supported interpretation" }),
    el("h2", { className: "h2", text: "A small high-score tail accounts for most squared error" }),
    el("p", { className: "small", text: `The ten largest misses account for ${formatNumber(summary.top10_squared_error_share_pct, 2)}% of total squared error. In the 80+ actual-score band, the export records ${formatNumber(outlierBand?.n, 0)} test rows and MAE ${formatNumber(outlierBand?.mae, 2)} marks.` }),
    el("p", { className: "small", text: "A possible explanation recorded in the project is that the available features do not explain some unusually high scores; the dataset may omit relevant context." }),
    el("p", { className: "small", text: "These are possible explanations consistent with the results, but they are not established causal explanations." }),
  );
  section.append(
    metrics,
    actualVsPredicted,
    residualSection,
    breakdown,
    largestSection,
    interpretation,
  );
  container.replaceChildren(section);
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
  charts.forEach((chart) => chart.destroy());
  charts = [];
}
