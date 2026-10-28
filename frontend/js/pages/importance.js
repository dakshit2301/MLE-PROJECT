/*
Purpose: Explain saved predictive-importance and coefficient results.
Inputs: The exported permutation and coefficient importance data.
Outputs: Method views, agreement tables, and page cleanup.
*/
import { makeBar } from "../charts.js";
import { createSegmented, el, formatNumber } from "../ui.js";

let cleanup = [];
let chart = null;

const label = (name) => name.replaceAll("_", " ");

function ranked(records, key, absolute = false) {
  return [...records].sort((a, b) => absolute
    ? Math.abs(b[key]) - Math.abs(a[key])
    : b[key] - a[key]);
}

function errorBarsPlugin() {
  return {
    id: "importance-error-bars",
    afterDatasetsDraw(instance) {
      const dataset = instance.data.datasets[0];
      const meta = instance.getDatasetMeta(0);
      const scale = instance.scales.x;
      if (!dataset.errors || !scale) return;
      const ctx = instance.ctx;
      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-dim").trim();
      dataset.errors.forEach((error, index) => {
        const bar = meta.data[index];
        if (!bar || !Number.isFinite(error)) return;
        const center = Number(dataset.data[index]);
        const left = scale.getPixelForValue(center - error);
        const right = scale.getPixelForValue(center + error);
        const y = bar.y;
        ctx.beginPath();
        ctx.moveTo(left, y); ctx.lineTo(right, y);
        ctx.moveTo(left, y - 4); ctx.lineTo(left, y + 4);
        ctx.moveTo(right, y - 4); ctx.lineTo(right, y + 4);
        ctx.stroke();
      });
      ctx.restore();
    },
  };
}

function zeroLinePlugin() {
  return {
    id: "importance-zero-line",
    afterDraw(instance) {
      const scale = instance.scales.x;
      if (!scale) return;
      const x = scale.getPixelForValue(0);
      const ctx = instance.ctx;
      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-dim").trim();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, instance.chartArea.top);
      ctx.lineTo(x, instance.chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };
}

function readPanel(method) {
  const copy = {
    permutation: [
      "A larger decrease in test R² after shuffling means the fitted model relied more on that feature for predictive performance.",
      "Error whiskers show the recorded permutation standard deviation.",
      "The results describe this dataset and fitted model, not an intervention.",
    ],
    coefficients: [
      "Bars show standardized regression coefficients from the final Linear Regression.",
      "Positive and negative signs describe fitted direction with other inputs held equal.",
      "Numeric values are per standard deviation; ordinal values are per category step.",
    ],
    tree: [
      "Tree-model importance summarizes split-based contribution inside each fitted tree ensemble.",
      "Random Forest and Gradient Boosting values are shown as separate series.",
      "Tree importance is not causal evidence and is not comparable in scale to coefficients.",
    ],
  };
  return el("aside", { className: "card stack importance-reading" },
    el("h2", { className: "h3", text: "How to read this" }),
    el("ul", { className: "interpretation-card__list" },
      copy[method].map((item) => el("li", { text: item })),
    ),
  );
}

function chartFor(method, importance) {
  if (method === "permutation") {
    const records = ranked(importance.permutation, "mean_decrease_r2");
    return makeBar({
      labels: records.map((item) => label(item.feature)),
      datasets: [{
        label: "Mean decrease in test R²",
        data: records.map((item) => item.mean_decrease_r2),
        errors: records.map((item) => item.std),
      }],
    }, {
      title: "Permutation importance",
      subtitle: "Mean decrease in held-out test R²; whiskers show permutation standard deviation",
      xLabel: "Mean decrease in test R²",
      yLabel: "Feature",
      tableRows: records.map((item) => ({
        Feature: item.feature,
        "Mean decrease in test R²": item.mean_decrease_r2,
        "Standard deviation": item.std,
        Rank: item.rank,
      })),
      plugins: [errorBarsPlugin()],
      chartOptions: {
        indexAxis: "y",
        scales: { x: { beginAtZero: true, title: { display: true, text: "Mean decrease in test R²" } } },
      },
    });
  }
  if (method === "coefficients") {
    const records = ranked(importance.coefficients, "coefficient", true);
    const extent = Math.max(...records.map((item) => Math.abs(item.coefficient)));
    return makeBar({
      labels: records.map((item) => label(item.feature)),
      datasets: [{
        label: "Standardized coefficient",
        data: records.map((item) => item.coefficient),
        backgroundColor: (context) => records[context.dataIndex].coefficient >= 0
          ? getComputedStyle(document.documentElement).getPropertyValue("--teal").trim()
          : getComputedStyle(document.documentElement).getPropertyValue("--rose").trim(),
      }],
    }, {
      title: "Linear Regression coefficients",
      subtitle: "Standardized coefficients; positive and negative signs are retained",
      xLabel: "Coefficient (marks per standardized step)",
      yLabel: "Feature",
      tableRows: records.map((item) => ({
        Feature: item.feature,
        Coefficient: item.coefficient,
        Direction: item.sign,
      })),
      plugins: [zeroLinePlugin()],
      chartOptions: {
        indexAxis: "y",
        scales: {
          x: {
            min: -extent * 1.1,
            max: extent * 1.1,
            title: { display: true, text: "Standardized coefficient" },
          },
        },
      },
    });
  }
  const records = importance.tree;
  const features = [...new Set(records.map((item) => item.feature))];
  const models = [...new Set(records.map((item) => item.model ?? item.Model ?? item.estimator))];
  return makeBar({
    labels: features.map(label),
    datasets: models.map((modelName) => ({
      label: modelName,
      data: features.map((feature) =>
        records.find((item) => item.feature === feature
          && (item.model ?? item.Model ?? item.estimator) === modelName)?.importance ?? null),
    })),
  }, {
    title: "Tree-model feature importance",
    subtitle: "Recorded Random Forest and Gradient Boosting importances",
    xLabel: "Importance",
    yLabel: "Feature",
    tableRows: records.map((item) => ({
      Model: item.model ?? item.Model ?? item.estimator,
      Feature: item.feature,
      Importance: item.importance,
    })),
    chartOptions: { indexAxis: "y" },
  });
}

export async function render(container, context) {
  destroy();
  const importance = await context.loadJSON("importance.json");
  const methods = [
    ...(importance.permutation?.length ? [{ name: "permutation", label: "Permutation (final model)" }] : []),
    ...(importance.coefficients?.length ? [{ name: "coefficients", label: "Coefficients (Linear Regression)" }] : []),
    ...(importance.tree?.length ? [{ name: "tree", label: "Tree models (RF / GB)" }] : []),
  ];
  let selectedMethod = methods[0]?.name ?? "";
  const section = el("section", { className: "page-shell fe04-page importance-page" },
    el("p", { className: "page-shell__eyebrow", text: "Model interpretation" }),
    el("h1", { className: "page-shell__title", text: "Predictive importance" }),
    el("p", { className: "page-shell__purpose", text: "Compare the signals recorded for the fitted model without treating them as causal effects." }),
    el("div", { className: "callout callout--honesty importance-honesty" },
      el("span", { className: "callout__icon", text: "i", "aria-hidden": "true" }),
      el("p", { className: "callout__text", text: "Predictive importance is not causal importance. A feature that predicts exam scores well in this dataset has not been shown to change exam scores." }),
    ),
  );
  const methodHost = el("div");
  const chartHost = el("div");
  const readingHost = el("div");
  const explainer = el("p", { className: "small importance-explanation" });
  const setMethod = (method) => {
    selectedMethod = method.name;
    chart?.destroy();
    chart = chartFor(selectedMethod, importance);
    chartHost.replaceChildren(chart.element);
    readingHost.replaceChildren(readPanel(selectedMethod));
    explainer.textContent = selectedMethod === "coefficients"
      ? "Coefficient interpretation: per one standard deviation (numeric) or per category step (ordinal), other features equal. These are fitted model relationships."
      : selectedMethod === "permutation"
        ? "Permutation importance measures the change in held-out predictive performance after a feature is shuffled."
        : "Tree importance values summarize split-based model behavior.";
  };
  const segmented = createSegmented(methodHost, {
    label: "Importance method",
    items: methods.map((method) => ({ label: method.label, name: method.name })),
  }, setMethod);
  cleanup.push(() => segmented.destroy());
  setMethod({ name: selectedMethod });

  const presentMethods = [
    ...(importance.permutation?.length ? [{
      label: "Permutation",
      features: ranked(importance.permutation, "mean_decrease_r2").slice(0, 5).map((item) => item.feature),
    }] : []),
    ...(importance.coefficients?.length ? [{
      label: "Coefficients",
      features: ranked(importance.coefficients, "coefficient", true).slice(0, 5).map((item) => item.feature),
    }] : []),
    ...(importance.tree?.length ? [{
      label: "Tree model",
      features: ranked(importance.tree, "importance").slice(0, 5).map((item) => item.feature),
    }] : []),
  ];
  const common = presentMethods.length
    ? presentMethods.map((method) => new Set(method.features))
      .reduce((shared, features) => new Set([...shared].filter((feature) => features.has(feature))))
    : new Set();
  const union = [...new Set(presentMethods.flatMap((method) => method.features))];
  const agreement = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "Agreement across available methods" }),
    el("p", { className: "small", text: common.size
      ? `${[...common].map(label).join(", ")} appear in the top five under all ${formatNumber(presentMethods.length, 0)} available methods.`
      : "No feature appears in the top five under every available method." }),
    el("div", { className: "table-wrap" }, (() => {
      const rows = union.map((feature) => {
        const row = { Feature: feature };
        presentMethods.forEach((method) => {
          const rank = method.features.indexOf(feature);
          row[method.label] = rank < 0 ? "—" : formatNumber(rank + 1, 0);
        });
        return row;
      });
      const columns = rows.length ? Object.keys(rows[0]) : ["Feature"];
      const table = el("table", { className: "data-table", "aria-label": "Top five feature rankings by available method" });
      table.append(el("thead", {},
        el("tr", {},
          columns.map((column) => el("th", { scope: "col", text: column })),
        ),
      ));
      const body = el("tbody");
      rows.forEach((row) => body.append(el("tr", { className: common.has(row.Feature) ? "is-selected" : "" },
        columns.map((column) => el("td", { text: row[column] })))));
      table.append(body);
      return table;
    })()),
  );
  const threshold = 0.001;
  const lowValue = importance.permutation.filter((item) => item.mean_decrease_r2 < threshold);
  const lowValueSection = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "Little or no predictive value in this dataset" }),
    el("p", { className: "small", text: `Threshold: permutation mean decrease in R² below ${formatNumber(threshold, 3)}. This does not prove a feature has no real-world relevance.` }),
    lowValue.length
      ? el("ul", { className: "chip-list" }, lowValue.map((item) =>
        el("li", { className: "chip", title: "Low predictive value here does not establish real-world irrelevance.", text: `${label(item.feature)} showed almost no predictive value in this dataset · ΔR² ${formatNumber(item.mean_decrease_r2, 4)}` })))
      : el("p", { className: "small", text: "No features fall below this threshold." }),
  );
  const noTree = !importance.tree?.length
    ? el("p", { className: "small", text: "Tree-model importance is not present in the exported data; that method is not shown." })
    : null;
  section.append(
    methodHost,
    el("div", { className: "importance-method-layout" }, el("div", { className: "stack" }, explainer, chartHost), readingHost),
    noTree,
    agreement,
    lowValueSection,
    el("a", { className: "button button--primary", href: "#/predict", text: "See how each feature moves a single prediction →" }),
  );
  container.replaceChildren(section);
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
  chart?.destroy();
  chart = null;
}
