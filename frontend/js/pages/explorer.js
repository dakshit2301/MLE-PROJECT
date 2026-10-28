/*
Purpose: Explore dataset distributions, relationships, and groups.
Inputs: Exported EDA, correlations, metadata, and feature schema.
Outputs: Interactive charts and accessible summaries for exploration.
*/
import {
  makeBar,
  makeHistogram,
  makeLine,
  makeScatter,
} from "../charts.js";
import { createTabs, el, formatNumber } from "../ui.js";

let cleanup = [];
let charts = [];

const numericLabel = (name) => name.replaceAll("_", " ");

function makeSelect(label, options, selected, onChange) {
  const id = `explore-${Math.random().toString(36).slice(2)}`;
  const select = el("select", { id, "aria-label": label });
  options.forEach((option) => select.append(el("option", {
    value: option.value,
    text: option.label,
    selected: option.value === selected,
  })));
  select.addEventListener("change", () => onChange(select.value));
  return el("label", { className: "field-label", for: id },
    el("span", { text: label }),
    select,
  );
}

function chartHost(parent, nextChart) {
  charts.forEach((chart) => chart.destroy());
  charts = [nextChart];
  parent.replaceChildren(nextChart.element);
}

function dataTable(rows, label) {
  const columns = rows.length ? Object.keys(rows[0]) : ["Feature", "Value"];
  const table = el("table", { className: "data-table", "aria-label": label });
  table.append(el("thead", {}, el("tr", {}, columns.map((column) =>
    el("th", { scope: "col", text: column })) )));
  const body = el("tbody");
  rows.forEach((row) => body.append(el("tr", {}, columns.map((column) => {
    const value = row[column];
    return el("td", {
      className: typeof value === "number" ? "is-numeric" : "",
      text: typeof value === "number" ? formatNumber(value, 3) : String(value ?? "Not available"),
    });
  }))));
  table.append(body);
  return table;
}

function metric(label, value, note) {
  return el("article", { className: "card metric-card fe04-metric" },
    el("span", { className: "metric-card__label", text: label }),
    el("strong", { className: "metric-card__value num", text: value }),
    el("span", { className: "metric-card__note", text: note }),
  );
}

function drawHeatmap(host, correlations, mode, sorted, featureLabels) {
  const target = "Exam_Score";
  const ranked = [...correlations.table]
    .sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));
  const included = mode === "top"
    ? [...ranked.slice(0, 8).map((row) => row.feature), target]
    : correlations.matrix.labels;
  let labels = included;
  if (sorted) {
    labels = [...included].sort((left, right) => {
      const a = correlations.table.find((row) => row.feature === left)?.pearson ?? 1;
      const b = correlations.table.find((row) => row.feature === right)?.pearson ?? 1;
      return Math.abs(b) - Math.abs(a);
    });
  }
  const indices = labels.map((label) => correlations.matrix.labels.indexOf(label));
  const grid = el("div", {
    className: "correlation-grid",
    role: "grid",
    "aria-label": `${labels.length} by ${labels.length} Pearson correlation matrix`,
    style: { "--heatmap-columns": `repeat(${labels.length}, minmax(2.4rem, 1fr))` },
  });
  const status = el("p", { className: "small correlation-cell-status", role: "status", "aria-live": "polite" });
  const headers = el("div", { className: "correlation-grid__headers" },
    el("span", { className: "correlation-grid__corner", text: "Feature" }),
    labels.map((label) => el("span", {
      className: "correlation-grid__column-label",
      text: featureLabels[label] ?? numericLabel(label),
      title: label,
    })),
  );
  const rows = labels.map((rowLabel, rowPosition) => {
    const row = el("div", { className: "correlation-grid__row" });
    const sortButton = el("button", {
      className: "correlation-grid__row-label",
      type: "button",
      text: featureLabels[rowLabel] ?? numericLabel(rowLabel),
      title: `Sort by correlation with ${target}`,
      onClick: () => drawHeatmap(host, correlations, mode, true, featureLabels),
    });
    row.append(sortButton);
    indices.forEach((columnIndex, columnPosition) => {
      const value = correlations.matrix.values[indices[rowPosition]][columnIndex];
      const intensity = Math.min(100, Math.abs(value) * 100);
      const button = el("button", {
        className: `correlation-cell${value >= 0 ? " is-positive" : " is-negative"}`,
        type: "button",
        role: "gridcell",
        style: { "--correlation-strength": `${intensity}%` },
        "aria-label": `${rowLabel} × ${labels[columnPosition]}: r = ${formatNumber(value, 3)}`,
        title: `${rowLabel} × ${labels[columnPosition]}: r = ${formatNumber(value, 3)}`,
        text: formatNumber(value, 1),
      });
      const announce = () => {
        status.textContent = `${rowLabel} × ${labels[columnPosition]}: r = ${formatNumber(value, 3)}`;
      };
      button.addEventListener("mouseenter", announce);
      button.addEventListener("focus", announce);
      row.append(button);
    });
    return row;
  });
  host.replaceChildren(
    el("div", { className: "correlation-legend", "aria-label": "Correlation color legend" },
      el("span", { text: "Negative association" }),
      el("span", { className: "correlation-legend__bar", "aria-hidden": "true" }),
      el("span", { text: "Positive association" }),
    ),
    status,
    el("div", { className: "correlation-grid-scroll" }, headers, rows),
  );
}

export async function render(container, context) {
  destroy();
  const [eda, correlations, meta, modelSpec] = await Promise.all([
    context.loadJSON("eda.json"),
    context.loadJSON("correlations.json"),
    context.loadJSON("meta.json"),
    context.loadJSON("model_spec.json"),
  ]);
  const section = el("section", { className: "page-shell fe04-page explorer-page" },
    el("p", { className: "page-shell__eyebrow", text: "Dataset patterns" }),
    el("h1", { className: "page-shell__title", text: "Explore the dataset" }),
    el("p", { className: "page-shell__purpose", text: "Inspect exported distributions, relationships, correlations, and group summaries." }),
  );
  const tabHost = el("div");
  const panel = el("section", { className: "explorer-panel", "aria-live": "polite" });
  const featureLabels = Object.fromEntries(modelSpec.features_used.map((item) => [item.name, item.label]));
  featureLabels[meta.target] = "Exam score";
  const numericFeatures = Object.keys(eda.numeric_hist);
  const categoricalFeatures = Object.keys(eda.categorical_counts);

  function renderOverview() {
    const quality = eda.data_quality;
    const missingCells = Object.values(quality.missing_by_column).reduce((sum, value) => sum + value, 0);
    const rows = [
      ...modelSpec.features_used.map((feature) => ({
        feature: feature.name,
        type: feature.kind === "numeric" ? "Numeric" : "Categorical",
        range: feature.kind === "numeric"
          ? `${formatNumber(eda.numeric_hist[feature.name].bin_edges[0], 1)}–${formatNumber(eda.numeric_hist[feature.name].bin_edges.at(-1), 1)}`
          : (eda.categorical_counts[feature.name] ?? []).map((item) => item.level).join(", "),
        role: "Used by final model",
      })),
      {
        feature: meta.target,
        type: "Numeric",
        range: `${formatNumber(meta.target_stats.min, 0)}–${formatNumber(meta.target_stats.max, 0)}`,
        role: "Target",
      },
      ...modelSpec.features_not_used.map((feature) => ({
        feature,
        type: "Engineered",
        range: "Not available",
        role: "Not used by final model",
      })),
    ];
    let filter = "";
    let role = "all";
    const tableHost = el("div");
    const search = el("input", {
      type: "search",
      className: "text-input",
      placeholder: "Filter feature names",
      "aria-label": "Filter data dictionary",
      onInput: () => updateTable(),
    });
    const roleToggle = el("select", {
      "aria-label": "Filter by model use",
      onChange: () => { role = roleToggle.value; updateTable(); },
    },
    el("option", { value: "all", text: "All features" }),
    el("option", { value: "used", text: "Used by model" }),
    el("option", { value: "unused", text: "Not used" }));
    const updateTable = () => {
      filter = search.value.trim().toLowerCase();
      const filtered = rows.filter((row) =>
        row.feature.toLowerCase().includes(filter)
        && (role === "all" || (role === "used"
          ? row.role === "Used by final model" || row.role === "Target"
          : row.role === "Not used by final model")));
      tableHost.replaceChildren(dataTable(filtered.map((row) => ({
        Feature: row.feature,
        Type: row.type,
        "Observed range / levels": row.range,
        Role: row.role,
      })), "Dataset feature dictionary"));
    };
    const metrics = el("div", { className: "grid fe04-metrics" },
      metric("Rows", `${formatNumber(meta.n_rows_raw, 0)} → ${formatNumber(meta.n_rows_clean, 0)}`, "Raw → cleaned dataset"),
      metric("Columns", formatNumber(meta.n_columns, 0), "Dataset columns"),
      metric("Duplicates", formatNumber(quality.n_duplicates, 0), "Duplicate rows"),
      metric("Missing cells", formatNumber(missingCells, 0), "Across columns with missing values"),
      metric("Rows removed", formatNumber(quality.rows_removed, 0), quality.rows_removed_reason),
    );
    const warning = el("div", { className: "callout callout--honesty" },
      el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }),
      el("p", { className: "callout__text", text: "The target is Exam_Score, not CGPA. Stress level and screen time were not measured. The project notes that the dataset appears simulated; its source details still need confirmation." }),
    );
    const controls = el("div", { className: "cluster explorer-dictionary-controls" },
      el("label", { className: "field-label" }, el("span", { text: "Search features" }), search),
      el("label", { className: "field-label" }, el("span", { text: "Model use" }), roleToggle),
    );
    updateTable();
    panel.replaceChildren(
      metrics,
      warning,
      el("section", { className: "card stack" },
        el("div", { className: "home-section-heading" },
          el("h2", { className: "h2", text: "Data dictionary" }),
          el("p", { className: "small", text: "Feature types and observed values come from the model specification and EDA export." }),
        ),
        controls,
        el("div", { className: "table-wrap" }, tableHost),
      ),
    );
  }

  function renderDistributions() {
    const host = el("div");
    const featureNames = [...numericFeatures, ...categoricalFeatures];
    const picker = makeSelect("Feature", featureNames.map((name) => ({
      value: name,
      label: featureLabels[name] ?? numericLabel(name),
    })), "Exam_Score", drawDistribution);
    const chartHostElement = el("div");
    const stats = el("p", { className: "small", role: "status" });
    function drawDistribution(name) {
      if (eda.numeric_hist[name]) {
        const record = eda.numeric_hist[name];
        const edges = record.bin_edges;
        const labels = record.counts.map((_, index) => `${formatNumber(edges[index], 1)}–${formatNumber(edges[index + 1], 1)}`);
        const rows = record.counts.map((count, index) => ({
          "Score / value range": labels[index],
          Count: count,
        }));
        const mean = name === meta.target ? meta.target_stats.mean : null;
        stats.textContent = `Mean: ${mean === null ? "Not available in the export" : formatNumber(mean, 2)} · Median: Not available in the export.`;
        const meanPlugin = mean === null ? [] : [{
          id: "explore-mean-marker",
          afterDatasetsDraw(chart) {
            const scale = chart.scales.x;
            if (!scale) return;
            const fraction = (mean - edges[0]) / (edges.at(-1) - edges[0] || 1);
            const x = scale.left + fraction * (scale.right - scale.left);
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--amber").trim();
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(x, chart.chartArea.top);
            ctx.lineTo(x, chart.chartArea.bottom);
            ctx.stroke();
            ctx.restore();
          },
        }];
        chartHost(chartHostElement, makeHistogram({
          labels,
          datasets: [{ label: "Students", data: record.counts }],
        }, {
          title: `${featureLabels[name] ?? numericLabel(name)} distribution`,
          subtitle: "Histogram from the cleaned dataset",
          xLabel: name,
          yLabel: "Student count",
          tableRows: rows,
          plugins: meanPlugin,
        }));
      } else {
        const rows = eda.categorical_counts[name];
        stats.textContent = "Counts and percentages are from the cleaned dataset.";
        chartHost(chartHostElement, makeBar({
          labels: rows.map((item) => item.level),
          datasets: [{ label: "Students", data: rows.map((item) => item.count) }],
        }, {
          title: `${featureLabels[name] ?? numericLabel(name)} categories`,
          subtitle: "Ordered levels; percentage is included in the accessible table",
          xLabel: "Category",
          yLabel: "Student count",
          tableRows: rows.map((item) => ({
            Category: item.level,
            Students: item.count,
            "Percent (%)": item.percent,
          })),
        }));
      }
    }
    drawDistribution("Exam_Score");
    panel.replaceChildren(
      el("div", { className: "cluster explore-controls" }, picker, stats),
      chartHostElement,
    );
  }

  function renderRelationships() {
    const host = el("div");
    const names = Object.keys(eda.scatter);
    const selected = { name: names[0] };
    const chartHostElement = el("div");
    const metrics = el("div", { className: "cluster" });
    const sentence = el("p", { className: "small relationship-summary" });
    const binnedToggle = el("input", { type: "checkbox", id: "relationship-binned" });
    const binnedLabel = el("label", { className: "checkbox-label", for: "relationship-binned" },
      binnedToggle,
      el("span", { text: "Show binned means" }),
    );
    const rangeMin = el("input", { type: "range", "aria-label": "Minimum visible feature value" });
    const rangeMax = el("input", { type: "range", "aria-label": "Maximum visible feature value" });
    const rangeLabel = el("p", { className: "small", "aria-live": "polite" });
    const rangeControls = el("div", { className: "range-pair" },
      el("label", { className: "field-label" }, el("span", { text: "Minimum x value" }), rangeMin),
      el("label", { className: "field-label" }, el("span", { text: "Maximum x value" }), rangeMax),
      rangeLabel,
    );
    const picker = makeSelect("Feature vs Exam_Score", names.map((name) => ({
      value: name,
      label: featureLabels[name] ?? numericLabel(name),
    })), selected.name, (name) => { selected.name = name; update(); });
    const binnedInput = eda.binned_means;
    binnedToggle.addEventListener("change", update);
    function update() {
      const item = eda.scatter[selected.name];
      const points = item.points.map(([x, y]) => ({ x, y }));
      const xs = points.map((point) => point.x);
      const min = Math.min(...xs);
      const max = Math.max(...xs);
      const fitted = item.fitted_line;
      const datasets = [
        { label: "Students (sample)", data: points, showLine: false, pointRadius: 2, pointHoverRadius: 5 },
        { label: "Fitted line (all rows)", data: [
          { x: min, y: fitted.slope * min + fitted.intercept },
          { x: max, y: fitted.slope * max + fitted.intercept },
        ], type: "line", pointRadius: 0, borderDash: [6, 4] },
      ];
      const bins = binnedInput[selected.name] ?? [];
      if (binnedToggle.checked && bins.length) {
        datasets.push({
          label: "Binned mean",
          data: bins.map((bin) => ({
            x: (parseFloat(bin.bin.match(/-?\d+(?:\.\d+)?/)?.[0] ?? "0")
              + parseFloat([...bin.bin.matchAll(/-?\d+(?:\.\d+)?/g)].at(-1)?.[0] ?? "0")) / 2,
            y: bin.mean,
            n: bin.n,
            bin: bin.bin,
          })),
          type: "line",
          showLine: false,
          pointRadius: 6,
          pointHoverRadius: 8,
        });
      }
      const binDataset = datasets.at(-1);
      if (binnedToggle.checked && bins.length) {
        binDataset.data = bins.map((bin, index) => ({
          x: min + (max - min) * (index + 0.5) / bins.length,
          y: bin.mean,
          n: bin.n,
          bin: bin.bin,
        }));
      }
      const low = Number.isFinite(Number(rangeMin.value)) ? Number(rangeMin.value) : min;
      const high = Number.isFinite(Number(rangeMax.value)) ? Number(rangeMax.value) : max;
      chartHost(chartHostElement, makeScatter({ datasets }, {
        title: `${featureLabels[selected.name] ?? numericLabel(selected.name)} and Exam_Score`,
        subtitle: "Sampled scatter with a fitted line computed from all cleaned rows",
        xLabel: featureLabels[selected.name] ?? numericLabel(selected.name),
        yLabel: "Exam_Score",
        tableRows: points.slice(0, 100).map((point) => ({ [selected.name]: point.x, Exam_Score: point.y }))
          .concat([{ Note: `Showing ${item.points.length} of ${formatNumber(item.n_total, 0)} students` }]),
        scales: {
          x: { min: low, max: high, title: { display: true, text: featureLabels[selected.name] ?? numericLabel(selected.name) } },
        },
        chartOptions: {
          plugins: {
            tooltip: {
              callbacks: {
                afterBody(items) {
                  const raw = items[0]?.raw;
                  return raw?.n ? [`${raw.bin}: n = ${raw.n}`] : [];
                },
              },
            },
          },
        },
      }));
      const pearson = item.pearson;
      const spearman = item.spearman;
      metrics.replaceChildren(
        el("span", { className: "stat-pill", text: `Showing ${formatNumber(item.points.length, 0)} of ${formatNumber(item.n_total, 0)} students` }),
        el("span", { className: "stat-pill", text: `Pearson r ${formatNumber(pearson, 3)} · ${correlations.table.find((row) => row.feature === selected.name)?.strength ?? "association"}` }),
        el("span", { className: "stat-pill", text: `Spearman ρ ${formatNumber(spearman, 3)}` }),
      );
      sentence.textContent = `In this dataset, ${numericLabel(selected.name)} was ${pearson >= 0 ? "positively" : "negatively"} associated with Exam_Score (Pearson r = ${formatNumber(pearson, 3)}; ${correlations.table.find((row) => row.feature === selected.name)?.strength ?? "association"}). Association does not establish causality.`;
      if (!rangeMin.value || Number(rangeMin.max) !== max) {
        [rangeMin, rangeMax].forEach((range) => {
          range.min = String(min);
          range.max = String(max);
          range.step = String(Math.max((max - min) / 100, 0.01));
        });
        rangeMin.value = String(min);
        rangeMax.value = String(max);
      }
      rangeLabel.textContent = `Visible x range: ${formatNumber(low, 1)}–${formatNumber(high, 1)}. Set both limits equal to the full range to reset.`;
    }
    [rangeMin, rangeMax].forEach((range) => range.addEventListener("input", () => {
      const min = Number(rangeMin.value);
      const max = Number(rangeMax.value);
      if (min > max) {
        if (range === rangeMin) rangeMax.value = rangeMin.value;
        else rangeMin.value = rangeMax.value;
      }
      update();
    }));
    update();
    panel.replaceChildren(
      el("div", { className: "cluster explore-controls" }, picker, binnedLabel),
      metrics,
      sentence,
      rangeControls,
      chartHostElement,
    );
  }

  function renderCorrelations() {
    let mode = "top";
    let sorted = false;
    const heatmapHost = el("div");
    const update = () => drawHeatmap(heatmapHost, correlations, mode, sorted, featureLabels);
    const modeSelect = el("select", {
      "aria-label": "Correlation features",
      onChange: () => { mode = modeSelect.value; sorted = false; update(); },
    },
    el("option", { value: "top", text: "Top 8 by |r| plus target" }),
    el("option", { value: "all", text: "All features" }));
    const targetRows = correlations.table.map((row) => ({
      Feature: row.feature,
      Pearson: row.pearson,
      Spearman: row.spearman,
      Strength: row.strength,
    }));
    const sortedRows = [...targetRows].sort((a, b) => Math.abs(b.Pearson) - Math.abs(a.Pearson));
    panel.replaceChildren(
      el("div", { className: "callout callout--honesty" },
        el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }),
        el("p", { className: "callout__text", text: "Correlation shows association only. It does not establish causal relationships." }),
      ),
      el("label", { className: "field-label" }, el("span", { text: "Heatmap view" }), modeSelect),
      heatmapHost,
      el("section", { className: "card stack" },
        el("h2", { className: "h2", text: "Ranked association with Exam_Score" }),
        el("div", { className: "table-wrap" }, dataTable(sortedRows, "Correlations with Exam_Score")),
      ),
    );
    update();
  }

  function renderGroups() {
    const featureNames = categoricalFeatures;
    const choice = { value: featureNames[0] };
    const smallMultiples = { enabled: false };
    const host = el("div");
    const selectHost = el("div");
    const picker = makeSelect("Categorical feature", featureNames.map((name) => ({
      value: name,
      label: featureLabels[name] ?? numericLabel(name),
    })), choice.value, (value) => { choice.value = value; update(); });
    const toggle = el("button", {
      className: "button button--secondary button--sm",
      type: "button",
      text: "Show all groups",
      "aria-pressed": "false",
      onClick: () => {
        smallMultiples.enabled = !smallMultiples.enabled;
        toggle.textContent = smallMultiples.enabled ? "Show one feature" : "Show all groups";
        toggle.setAttribute("aria-pressed", String(smallMultiples.enabled));
        update();
      },
    });
    function groupChart(name) {
      const values = eda.group_means[name] ?? [];
      const plugin = {
        id: `group-error-bars-${name}`,
        afterDatasetsDraw(chart) {
          const metaChart = chart.getDatasetMeta(0);
          const scale = chart.scales.y;
          const ctx = chart.ctx;
          ctx.save();
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-dim").trim();
          values.forEach((item, index) => {
            if (!Number.isFinite(item.std) || !metaChart.data[index]) return;
            const x = metaChart.data[index].x;
            const top = scale.getPixelForValue(item.mean + item.std);
            const bottom = scale.getPixelForValue(item.mean - item.std);
            ctx.beginPath();
            ctx.moveTo(x, top); ctx.lineTo(x, bottom);
            ctx.moveTo(x - 4, top); ctx.lineTo(x + 4, top);
            ctx.moveTo(x - 4, bottom); ctx.lineTo(x + 4, bottom);
            ctx.stroke();
          });
          ctx.restore();
        },
      };
      const chart = makeBar({
        labels: values.map((item) => item.level),
        datasets: [{ label: "Mean Exam_Score", data: values.map((item) => item.mean) }],
      }, {
        title: `Exam_Score by ${featureLabels[name] ?? numericLabel(name)}`,
        subtitle: "Group mean with standard-deviation whiskers",
        xLabel: "Category",
        yLabel: "Mean Exam_Score",
        tableRows: values.map((item) => ({
          Category: item.level,
          "Mean exam score": item.mean,
          "Standard deviation": item.std,
          Students: item.n,
          "Group note": item.n < 100 ? "Small group — interpret with care" : "—",
        })),
        plugins: [plugin],
      });
      return chart;
    }
    function update() {
      charts.forEach((chart) => chart.destroy());
      charts = [];
      if (smallMultiples.enabled) {
        const cards = featureNames.map((name) => {
          const values = eda.group_means[name] ?? [];
          const max = Math.max(...values.map((item) => item.mean));
          return el("article", { className: "card stack group-mini" },
            el("h3", { className: "h3", text: featureLabels[name] ?? numericLabel(name) }),
            values.map((item) => el("div", { className: "group-mini__row" },
              el("span", { text: item.level }),
              el("span", { className: "group-mini__track", "aria-hidden": "true" },
                el("span", { className: "group-mini__fill", style: { "--bar-width": `${(item.mean / max) * 100}%` } })),
              el("strong", { className: "num", text: formatNumber(item.mean, 2) }),
              el("span", { className: "small", text: `n = ${formatNumber(item.n, 0)}${item.n < 100 ? " · small group — interpret with care" : ""}` }),
            )),
          );
        });
        host.replaceChildren(el("div", { className: "grid group-mini-grid" }, cards));
      } else {
        const chart = groupChart(choice.value);
        charts = [chart];
        const values = eda.group_means[choice.value] ?? [];
        const notices = values.filter((item) => item.n < 100);
        host.replaceChildren(
          chart.element,
          el("div", { className: "cluster" }, values.map((item) =>
            el("span", { className: "stat-pill", text: `${item.level}: n = ${formatNumber(item.n, 0)}` })),
          ),
          notices.length ? el("p", { className: "small", text: `${notices.map((item) => item.level).join(", ")}: small group — interpret with care.` }) : null,
        );
      }
    }
    selectHost.append(picker, toggle);
    update();
    panel.replaceChildren(el("div", { className: "cluster explore-controls" }, selectHost), host);
  }

  const views = [renderOverview, renderDistributions, renderRelationships, renderCorrelations, renderGroups];
  const tabs = createTabs(tabHost, [
    { label: "Overview" },
    { label: "Distributions" },
    { label: "Relationships" },
    { label: "Correlations" },
    { label: "Groups" },
  ], (_tab, index) => views[index]());
  cleanup.push(() => tabs.destroy());
  views[0]();
  section.append(tabHost, panel);
  container.replaceChildren(section);
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
  charts.forEach((chart) => chart.destroy());
  charts = [];
}
