/*
Purpose: Document the real project workflow and its limitations.
Inputs: Exported metadata, model results, and data-quality summary.
Outputs: A reproducibility page with references and safeguards.
*/
import { copyToClipboard, el, formatNumber, toast } from "../ui.js";

let cleanup = [];

const workflow = [
  ["Problem definition", "The project asks which available student factors are associated with Exam_Score and how well regression models estimate it.", "data", "The target is Exam_Score; stress level and screen time are not measured."],
  ["Dataset acquisition", "A student-performance dataset was sourced from Kaggle; source details remain unconfirmed until checked by the student.", "data", "The dataset URL, author attribution, license, and access date are explicitly marked for confirmation. These fields should be verified before external reuse."],
  ["Dataset understanding", "The raw file was inspected for its shape, column types, target, and feature meaning.", "data", ""],
  ["Data quality analysis", "Missing cells, duplicate rows, invalid target values, and plausible extreme inputs were reviewed.", "data", ""],
  ["EDA", "Distributions, group summaries, correlations, and feature relationships were inspected before modeling.", "data", "The exported analysis includes Pearson and Spearman associations and sampled scatter points. These are descriptive summaries of the recorded data."],
  ["Data preprocessing", "Numeric values were scaled and missing categorical values imputed inside a scikit-learn pipeline.", "data", "The preprocessing pipeline was fitted within training data and cross-validation folds. This keeps learned preprocessing statistics separate from held-out evaluation data."],
  ["Feature engineering", "Candidate derived features were evaluated to test whether transformations added useful signal.", "data", "Candidates included interactions, sleep categories, tutoring indicators, and activity totals. The final selected feature set uses the original input columns."],
  ["Feature selection", "Cross-validation compared candidate feature sets before the held-out test set was used.", "data", "The final feature set retained the original input columns; engineered candidates were dropped. Selection was completed on training data."],
  ["Train/test split", "The dataset was divided into training and held-out test partitions before fitting transformations.", "model", ""],
  ["Baseline model", "A mean-prediction DummyRegressor provided a simple reference for model evaluation.", "model", "The baseline is included in the candidate comparison."],
  ["Model selection", "Candidate regressors were compared using cross-validation on training data.", "model", "The selection rule favored the highest mean CV R², with interpretability and error metrics also recorded. The held-out test set was reserved for final evaluation."],
  ["Model training", "The candidate estimators were fitted through preprocessing pipelines using the retained features.", "model", ""],
  ["Hyperparameter tuning", "Random Forest and Gradient Boosting parameter grids were searched using training cross-validation.", "model", "Tuning scores and parameter grids are exported. The test set was not used to select tuning parameters."],
  ["Model evaluation", "The final candidate pipelines were evaluated on the held-out test split after model selection.", "model", "The saved test metrics report R², MAE, MSE, and RMSE. They describe this held-out split."],
  ["Model comparison", "Cross-validation and held-out test results were compared and the selection rule was documented.", "model", "LinearRegression was selected using cross-validation before the test results were opened. Test metrics are reported separately from the selection step."],
  ["Error analysis", "Held-out residuals were summarized by score ranges and available feature groups.", "insight", "The exported summaries show where the model's recorded errors are larger. Group summaries are descriptive and may be sensitive to small sample sizes."],
  ["Model interpretation", "Permutation importance and standardized coefficients were used to describe fitted predictive behavior.", "insight", "These summaries describe model behavior and association, not intervention effects. Permutation importance is specific to this model and dataset."],
  ["Final prediction/demonstration", "Saved demonstration profiles were scored by the already-fitted pipeline.", "insight", "The frontend reproduces the exported model in JavaScript; it does not refit or retune it. Example profiles are demonstrations, not observed individuals."],
  ["Conclusion", "The final report summarizes evidence, limits, and directions for future data collection.", "insight", "Stress and screen time remain unmeasured; the analysis targets exam score rather than CGPA. Any next study should verify the source and collect relevant variables."],
];

function fact(label, value) {
  return el("article", { className: "card metric-card fe04-metric" },
    el("span", { className: "metric-card__label", text: label }),
    el("strong", { className: "metric-card__value num", text: value }),
  );
}

export async function render(container, context) {
  destroy();
  const [meta, models, eda] = await Promise.all([
    context.loadJSON("meta.json"),
    context.loadJSON("models.json"),
    context.loadJSON("eda.json"),
  ]);
  const quality = eda.data_quality;
  const missingCells = Object.values(quality.missing_by_column).reduce((sum, value) => sum + value, 0);
  const section = el("section", { className: "page-shell fe04-page method-page" },
    el("p", { className: "page-shell__eyebrow", text: "How the analysis was built" }),
    el("h1", { className: "page-shell__title", text: "A transparent workflow" }),
    el("p", { className: "page-shell__purpose", text: "The project follows the official analysis sequence while keeping the held-out test data separate from model selection." }),
    el("p", { className: "small", text: "Exam_Score is the target, not CGPA. Stress level and screen time were not measured in this dataset." }),
  );
  const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
      }
    }), { threshold: 0.1 })
    : null;
  const timeline = el("ol", { className: "workflow-timeline", "aria-label": "Official project workflow" },
    workflow.map(([title, summary, stage, detail], index) => {
      const stepDetail = index === 2
        ? `The cleaned export retains ${formatNumber(meta.n_rows_clean, 0)} rows across ${formatNumber(meta.n_columns, 0)} columns. The documented target is ${meta.target}.`
        : index === 3
          ? `${formatNumber(quality.rows_removed, 0)} row was removed: ${quality.rows_removed_reason} Duplicate rows recorded: ${formatNumber(quality.n_duplicates, 0)}.`
          : index === 8
            ? `${formatNumber(meta.n_rows_train, 0)} rows were assigned to training and ${formatNumber(meta.n_rows_test, 0)} to the held-out test set. The split preceded fitting the transformations.`
            : index === 11
              ? `${formatNumber(models.final_table.length, 0)} candidate model rows are recorded in the final comparison. The selected estimator is ${models.selected_model}.`
              : index === 13
                ? `The selected ${models.selected_model} reached test R² ${formatNumber(meta.final_model.test_r2, 3)} and CV R² ${formatNumber(meta.final_model.cv_r2, 3)}. Target status is shown below.`
                : detail;
      const item = el("li", { className: `workflow-step workflow-step--${stage}` });
      const disclosure = el("details", { className: "workflow-step__details" },
        el("summary", {},
          el("span", { className: "workflow-step__dot", "aria-hidden": "true" }),
          el("span", { className: "workflow-step__stage", text: stage }),
          el("span", { className: "workflow-step__title", text: title }),
          el("span", { className: "workflow-step__summary", text: summary }),
        ),
        el("p", { className: "small", text: stepDetail }),
      );
      item.append(disclosure);
      if (revealObserver) revealObserver.observe(item);
      else item.classList.add("is-revealed");
      return item;
    }),
  );
  if (revealObserver) cleanup.push(() => revealObserver.disconnect());

  const checks = [
    ["Split before fitting transformations", "The train/test split was made before preprocessing statistics were fitted."],
    ["Pipeline transformations", "Imputation, ordinal encoding, and scaling are inside the fitted pipeline and are learned on training folds."],
    ["Training-only tuning", "Feature selection and parameter tuning used cross-validation on the training partition."],
    ["Selection before test evaluation", "LinearRegression was selected before the test set was opened."],
    ["Single final test access", "The project state records that data/test.csv was read once for final descriptive evaluation."],
  ];
  const leakage = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "Leakage safeguards" }),
    el("ul", { className: "safeguard-list" }, checks.map(([title, description]) =>
      el("li", {},
        el("span", { className: "safeguard-list__check", "aria-hidden": "true", text: "✓" }),
        el("div", {}, el("strong", { text: title }), el("p", { className: "small", text: description })),
      ))),
  );

  const datasetFacts = el("section", { className: "stack" },
    el("h2", { className: "h2", text: "Dataset facts" }),
    el("div", { className: "grid fe04-metrics" },
      fact("Rows (raw → cleaned)", `${formatNumber(meta.n_rows_raw, 0)} → ${formatNumber(meta.n_rows_clean, 0)}`),
      fact("Columns", formatNumber(meta.n_columns, 0)),
      fact("Training / held-out test", `${formatNumber(meta.n_rows_train, 0)} / ${formatNumber(meta.n_rows_test, 0)}`),
      fact("Missing cells", formatNumber(missingCells, 0)),
    ),
    el("article", { className: "card stack" },
      el("h3", { className: "h3", text: meta.dataset.name }),
      el("p", { className: "small", text: `Source: ${meta.dataset.source}. URL: ${meta.dataset.url}. Author: ${meta.dataset.author}. License: ${meta.dataset.license}. Access date: ${meta.dataset.date_accessed}.` }),
      el("p", { className: "small", text: `Cleaning log: ${formatNumber(quality.rows_removed, 0)} row removed — ${quality.rows_removed_reason} Duplicate rows: ${formatNumber(quality.n_duplicates, 0)}.` }),
      el("p", { className: "small", text: `Rows with multiple missing fields: ${formatNumber(quality.rows_with_multiple_missing, 0)}. Missing values are retained for training-fold imputation.` }),
    ),
  );

  const limitations = [
    "The dataset looks synthetic or simulated based on its tight score distribution and smooth patterns; the original source details remain unconfirmed.",
    "Stress level and screen time are absent. Motivation and peer influence are separate recorded features, not replacements for those measurements.",
    "The target is one exam score, not CGPA, long-term academic progress, or conceptual mastery.",
    "The population, region, and sampling method are unknown, limiting generalization to specific institutions or student populations.",
    "The analysis is observational; correlation and fitted model behavior do not establish intervention effects.",
    "The high-score tail is not well explained by the available features; the largest errors account for a large share of squared error.",
    "Several inputs are coarse integer or ordinal categories, which limits measurement detail.",
  ];
  const cannotTell = el("section", { className: "card stack limitation-card" },
    el("h2", { className: "h2", text: "What this project cannot tell you" }),
    el("ul", { className: "interpretation-card__list" }, limitations.map((item) => el("li", { text: item }))),
  );

  const commands = [
    ["Export the approved frontend JSON", "python export_data.py"],
    ["Run the local frontend", "python -m http.server 8000"],
  ];
  const reproduce = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "Reproduce it locally" }),
    el("p", { className: "small", text: "Run commands from the frontend folder. Path A uses the exported JavaScript predictor and does not need a Python prediction server." }),
    commands.map(([title, command]) => {
      const code = el("code", { className: "reproduce-command", text: command });
      const button = el("button", {
        className: "button button--secondary button--sm",
        type: "button",
        text: "Copy command",
        onClick: async () => {
          try {
            await copyToClipboard(command);
            toast("Command copied.");
          } catch (error) {
            console.error(error);
            toast(error instanceof Error ? error.message : "Could not copy the command.");
          }
        },
      });
      return el("div", { className: "reproduce-row" }, el("strong", { text: title }), code, button);
    }),
  );
  const references = [
    ["Dataset: Student Performance Factors (Kaggle; attribution details unconfirmed)", "https://www.kaggle.com/datasets/lainguyn123/student-performance-factors"],
    ["Scikit-learn: user guide", "https://scikit-learn.org/stable/user_guide.html"],
    ["Pandas: documentation", "https://pandas.pydata.org/docs/"],
    ["Chart.js: documentation", "https://www.chartjs.org/docs/latest/"],
  ];
  const referenceSection = el("section", { className: "card stack" },
    el("h2", { className: "h2", text: "References" }),
    el("ul", { className: "reference-list" }, references.map(([title, url]) =>
      el("li", {}, el("a", {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        text: title,
      })))),
  );
  section.append(
    el("section", { className: "stack", "aria-labelledby": "workflow-title" },
      el("h2", { className: "h2", id: "workflow-title", text: "Project workflow" }),
      el("p", { className: "small", text: "Stages use the project’s official sequence and are grouped by data, model, and insight work." }),
      timeline,
    ),
    leakage,
    datasetFacts,
    cannotTell,
    el("article", { className: "card target-status" },
      el("p", { className: "page-shell__eyebrow", text: "Recorded model status" }),
      el("h2", { className: "h3", text: `${models.selected_model} · test R² ${formatNumber(meta.final_model.test_r2, 3)} · CV R² ${formatNumber(meta.final_model.cv_r2, 3)}` }),
      el("p", { className: "small", text: `Target ${formatNumber(meta.target_r2, 2)}: test ${meta.target_met_test ? "met" : "not met"} · CV ${meta.target_met_cv ? "met" : "not met"}.` }),
      el("p", { className: "small", text: meta.cv_vs_test_note }),
    ),
    reproduce,
    referenceSection,
  );
  container.replaceChildren(section);
}

export function destroy() {
  cleanup.forEach((dispose) => dispose());
  cleanup = [];
}
