import { el } from "./ui.js";

/*
Purpose: Build themed charts with accessible data-table alternatives.
Inputs: Saved data, chart options, and the local Chart.js library.
Outputs: Chart elements that clean up and re-theme with the app.
*/
const liveCharts = new Set();
const chartColors = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];

function cssColor(token, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

function requiredOptions(options) {
  for (const key of ["title", "xLabel", "yLabel"]) {
    if (typeof options?.[key] !== "string" || !options[key].trim()) {
      throw new TypeError(`A chart ${key} is required.`);
    }
  }
}

function themeOptions() {
  const text = cssColor("--text-dim", "#9AA4B2");
  const line = cssColor("--line", "#26303D");
  return {
    color: text,
    borderColor: line,
    font: { family: getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim() },
    scales: {
      x: {
        grid: { color: `color-mix(in srgb, ${line} 45%, transparent)` },
        ticks: { color: text },
        title: { color: text },
      },
      y: {
        grid: { color: `color-mix(in srgb, ${line} 45%, transparent)` },
        ticks: { color: text },
        title: { color: text },
      },
    },
    plugins: { legend: { labels: { color: text } } },
  };
}

export function applyChartTheme() {
  if (globalThis.Chart) {
    const theme = themeOptions();
    globalThis.Chart.defaults.color = theme.color;
    globalThis.Chart.defaults.font.family = theme.font.family;
    globalThis.Chart.defaults.borderColor = theme.borderColor;
  }
  for (const chart of liveCharts) chart.applyTheme?.();
}

window.addEventListener("themechange", applyChartTheme);

function makeTable(title, rows) {
  const columns = rows.length
    ? Object.keys(rows[0])
    : ["Label", "Value"];
  const table = el("table", { className: "data-table" });
  const head = el("thead");
  const headerRow = el("tr");
  columns.forEach((column) => headerRow.append(el("th", { scope: "col", text: column })));
  head.append(headerRow);
  const body = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    columns.forEach((column) => {
      const value = row[column] ?? "Not available";
      const display = typeof value === "number"
        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(Number(value.toFixed(4)))
        : value;
      tr.append(el("td", { text: display }));
    });
    body.append(tr);
  });
  table.append(head, body);
  table.setAttribute("aria-label", `${title} data`);
  return table;
}

function makeFrame(options, rows) {
  const frame = el("section", { className: "chart-frame", "aria-label": options.title });
  const header = el("header", { className: "chart-frame__header" });
  const heading = el("div");
  heading.append(
    el("h3", { className: "chart-frame__title", text: options.title }),
    el("p", { className: "chart-frame__subtitle", text: options.subtitle ?? `${options.xLabel} by ${options.yLabel}` }),
  );
  const toggle = el("button", {
    className: "button button--ghost button--sm",
    type: "button",
    text: "View data table",
    "aria-expanded": "false",
  });
  header.append(heading, toggle);
  const plot = el("div", { className: "chart-frame__plot" });
  const details = el("div", { className: "chart-frame__table", hidden: true });
  toggle.addEventListener("click", () => {
    const open = details.hidden;
    details.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide data table" : "View data table";
  });
  const table = makeTable(options.title, rows);
  details.append(el("div", { className: "table-wrap" }, table));
  frame.append(header, plot, details);
  return { frame, plot, details, table };
}

function makeChart(type, data, options) {
  requiredOptions(options);
  const rows = options.tableRows ?? (data.labels ?? []).map((label, index) => {
    const row = { [options.xLabel]: label };
    for (const dataset of data.datasets ?? []) row[dataset.label ?? "Series"] = dataset.data[index];
    return row;
  });
  const { frame, plot, details } = makeFrame(options, rows);
  let table = frame.querySelector(".chart-frame__table table");
  let chart = null;
  const requestedColors = (data.datasets ?? []).map((dataset) => ({
    borderColor: dataset.borderColor,
    backgroundColor: dataset.backgroundColor,
  }));
  if (globalThis.Chart) {
    const canvas = el("canvas", {
      role: "img",
      "aria-label": `${options.title}. ${options.xLabel} by ${options.yLabel}.`,
    });
    plot.append(canvas);
    const palette = chartColors.map((token) => cssColor(token, "#3FD0C0"));
    const datasets = (data.datasets ?? []).map((dataset, index) => ({
      ...dataset,
      borderColor: dataset.borderColor ?? palette[index % palette.length],
      backgroundColor: dataset.backgroundColor ?? `${palette[index % palette.length]}CC`,
    }));
    chart = new globalThis.Chart(canvas, {
      type,
      data: { ...data, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          title: { display: false, text: options.title },
          tooltip: { backgroundColor: cssColor("--bg-sunken", "#0A0E14"), titleColor: cssColor("--text", "#E8E4DA"), bodyColor: cssColor("--text", "#E8E4DA") },
          legend: { display: datasets.length > 1, labels: { usePointStyle: true } },
        },
        scales: {
          x: {
            title: { display: true, text: options.xLabel },
            grid: { color: `color-mix(in srgb, ${cssColor("--line", "#26303D")} 45%, transparent)` },
          },
          y: {
            title: { display: true, text: options.yLabel },
            grid: { color: `color-mix(in srgb, ${cssColor("--line", "#26303D")} 45%, transparent)` },
          },
          ...(options.scales ?? {}),
        },
        ...(options.chartOptions ?? {}),
      },
      plugins: options.plugins ?? [],
    });
  } else {
    plot.append(
      el("p", { className: "chart-fallback-note", role: "status", text: "Chart renderer unavailable; use the accessible data table below." }),
    );
    details.hidden = false;
    frame.querySelector("button").setAttribute("aria-expanded", "true");
    frame.querySelector("button").textContent = "Hide data table";
  }

  const controller = {
    element: frame,
    update(nextData, nextRows) {
      if (chart && nextData) {
        chart.data = nextData;
        chart.update();
      }
      const updatedRows = nextRows ?? (nextData?.labels ?? []).map((label, index) => {
        const row = { [options.xLabel]: label };
        for (const dataset of nextData.datasets ?? []) row[dataset.label ?? "Series"] = dataset.data[index];
        return row;
      });
      if (nextData || nextRows) {
        const replacement = makeTable(options.title, updatedRows);
        table.replaceWith(replacement);
        table = replacement;
      }
    },
    applyTheme() {
      if (!chart) return;
      const palette = chartColors.map((token) => cssColor(token, "#3FD0C0"));
      chart.data.datasets.forEach((dataset, index) => {
        const requested = requestedColors[index];
        dataset.borderColor = requested.borderColor ?? palette[index % palette.length];
        dataset.backgroundColor = requested.backgroundColor ?? `${palette[index % palette.length]}CC`;
      });
      const text = cssColor("--text-dim", "#9AA4B2");
      const line = cssColor("--line", "#26303D");
      chart.options.color = text;
      chart.options.scales.x.ticks.color = text;
      chart.options.scales.y.ticks.color = text;
      chart.options.scales.x.title.color = text;
      chart.options.scales.y.title.color = text;
      chart.options.scales.x.grid.color = line;
      chart.options.scales.y.grid.color = line;
      chart.options.plugins.tooltip.backgroundColor = cssColor("--bg-sunken", "#0A0E14");
      chart.options.plugins.tooltip.titleColor = cssColor("--text", "#E8E4DA");
      chart.options.plugins.tooltip.bodyColor = cssColor("--text", "#E8E4DA");
      chart.update("none");
    },
    destroy() {
      chart?.destroy();
      liveCharts.delete(controller);
      frame.remove();
    },
    get table() {
      return table;
    },
  };
  liveCharts.add(controller);
  controller.applyTheme();
  return controller;
}

export function makeBar(data, options) {
  return makeChart("bar", data, options);
}

export function makeScatter(data, options) {
  return makeChart("scatter", data, options);
}

export function makeLine(data, options) {
  return makeChart("line", data, options);
}

export function makeHistogram(data, options) {
  return makeChart("bar", data, options);
}

export function makeHeatmap(data, options) {
  requiredOptions(options);
  const labels = data.labels ?? [];
  const matrix = data.values ?? [];
  const rows = matrix.flatMap((row, rowIndex) =>
    row.map((value, columnIndex) => ({
      [options.xLabel]: labels[columnIndex],
      [options.yLabel]: labels[rowIndex],
      Correlation: value,
    })),
  );
  const { frame, plot, details, table } = makeFrame({ ...options, tableRows: rows }, rows);
  const svgNS = "http://www.w3.org/2000/svg";
  const cellSize = 34;
  const margin = 112;
  const dimension = margin + labels.length * cellSize;
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${dimension} ${dimension}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${options.title}. ${options.xLabel} and ${options.yLabel} correlation matrix.`);
  const title = document.createElementNS(svgNS, "title");
  title.textContent = options.title;
  svg.append(title);
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(margin + columnIndex * cellSize));
      rect.setAttribute("y", String(rowIndex * cellSize));
      rect.setAttribute("width", String(cellSize - 2));
      rect.setAttribute("height", String(cellSize - 2));
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", `color-mix(in srgb, ${value >= 0 ? cssColor("--teal", "#3FD0C0") : cssColor("--rose", "#F0707A")} ${Math.max(10, Math.abs(value) * 82)}%, var(--bg-sunken))`);
      rect.setAttribute("aria-label", `${labels[rowIndex]} and ${labels[columnIndex]}: ${value}`);
      const cellTitle = document.createElementNS(svgNS, "title");
      cellTitle.textContent = `${labels[rowIndex]} / ${labels[columnIndex]}: ${value}`;
      rect.append(cellTitle);
      svg.append(rect);
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(margin + columnIndex * cellSize + cellSize / 2 - 1));
      text.setAttribute("y", String(rowIndex * cellSize + cellSize / 2 + 4));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "var(--text)");
      text.setAttribute("font-size", "10");
      text.textContent = Number(value).toFixed(1);
      svg.append(text);
    });
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", String(margin - 8));
    label.setAttribute("y", String(rowIndex * cellSize + cellSize / 2 + 4));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "var(--text-dim)");
    label.setAttribute("font-size", "10");
    label.textContent = labels[rowIndex];
    svg.append(label);
  });
  labels.forEach((labelText, index) => {
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", String(margin + index * cellSize + cellSize / 2));
    label.setAttribute("y", String(margin + 12));
    label.setAttribute("text-anchor", "start");
    label.setAttribute("transform", `rotate(55 ${margin + index * cellSize + cellSize / 2} ${margin + 12})`);
    label.setAttribute("fill", "var(--text-dim)");
    label.setAttribute("font-size", "10");
    label.textContent = labelText;
    svg.append(label);
  });
  plot.replaceChildren(svg);
  return {
    element: frame,
    update() {},
    destroy() { frame.remove(); },
    table,
    applyTheme() {},
  };
}

export function toDataTable(chart) {
  return chart?.table ?? chart?.element?.querySelector(".chart-frame__table table") ?? null;
}
