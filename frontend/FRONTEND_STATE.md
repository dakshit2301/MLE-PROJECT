# Frontend State

## FE_01 — Data export and prediction engine

- Status: Complete.
- Required inputs: all FE_00 section 2 files were found before implementation.
- Final model: `LinearRegression` in a fitted `Pipeline` (`prep` ColumnTransformer + `model` LinearRegression); Path A selected. No model was changed or refit.
- Prediction setup: 6 numeric features, 13 ordinal features; exported scaler, imputer modes, category orders, column order, coefficients, and intercept from the fitted pipeline. Manual coefficient calculation matched pipeline predictions.
- Training/test sizes: 5,284 / 1,322. Final test R² = 0.8258; CV R² = 0.7171 ± 0.0731; test MAE = 0.4103; test RMSE = 1.5178; test p90 absolute error = 0.6424.
- Block 7 synthetic demo profiles were reused as the three model presets. The six evaluated engineered formulas are exported and implemented in JavaScript, but are not model inputs because Block 4 dropped them.

### FE_01 files

- `export_data.py`
- `js/predictor.js`
- `tests/parity_test.py`
- `tests/schema_check.py`
- `data/meta.json`
- `data/model_spec.json`
- `data/eda.json`
- `data/correlations.json`
- `data/models.json`
- `data/importance.json`
- `data/errors.json`
- `data/test_points.json`
- `data/viva.json`
- CSS, `js/pages/`, and vendor directories were created as empty FE_00 skeleton locations. No FE_02 UI files were added.

### Generated JSON sizes

| File | Bytes |
|---|---:|
| `meta.json` | 1,433 |
| `model_spec.json` | 12,358 |
| `eda.json` | 419,849 |
| `correlations.json` | 10,692 |
| `models.json` | 4,681 |
| `importance.json` | 4,851 |
| `errors.json` | 16,663 |
| `test_points.json` | 142,695 |
| `viva.json` | 21,869 |
| **Total** | **635,091** |

`test_points.json` contains all 1,322 held-out test rows (not sampled). Numeric scatter plots use at most 1,200 rows per feature with `random_state=42`.

### Verification

- `python export_data.py` from `frontend/`: passed; all nine JSON files written.
- Determinism: passed; all nine generated JSON SHA-256 hashes were identical across consecutive exports.
- `python tests/schema_check.py`: passed; all required keys and finite numbers checked; total JSON is below 1.5 MB.
- `python tests/parity_test.py`: **PARITY PASSED** for 100 seeded held-out rows, all three presets, and three rows with missing categories. Maximum JS/Python difference: `4.26325641456e-14` (threshold `< 1e-6`).
- Engineered-feature check: all six stored columns in `test.csv` matched formulas from the notebook.
- Display behavior: JS test verified MAE/RMSE bands, training-range warnings, 0–100 output clipping, and `sweep()`.
- **ML PROJECT UNTOUCHED:** SHA-256 hashes of all 4 `data/` and 12 `outputs/` files matched the pre-work baseline.

### Warnings and known source limits

- The source project still marks Kaggle URL, author, license, and access-date details as needing student confirmation. Exported metadata preserves those notes rather than treating README guesses as verified source facts.
- `cv_results.csv` does not contain per-fold R² values; `models.json.cv.per_fold_r2` is empty and states why.
- No saved RF/GB tree-importance table is present among the allowed export sources; `importance.json.tree` is empty.
- `reports/viva_questions.md` claims 52 questions in its introduction, but contains only 45 numbered Q1–Q45 question/answer headings. `viva.json` faithfully contains those 45 questions across 9 section headings; no missing questions were invented.
- The CV/test explanation is copied from `PROJECT_STATE.md`: the random test split has fewer extreme scorers, so its R² is higher; this is not evidence of improved generalization.

### Exact JSON fields for later pages

- `meta.json`: `dataset`, `n_rows_raw`, `n_rows_clean`, `n_rows_train`, `n_rows_test`, `target_stats`, `final_model`, `target_r2`, `target_met_test`, `target_met_cv`, `cv_vs_test_note`, `not_in_dataset`.
- `model_spec.json`: `path`, `model_name`, `features_used`, `features_not_used`, `categorical`, `engineered`, `column_order`, `imputation_modes`, `scaler`, `coefficients`, `output_clip`, `uncertainty`, `presets`.
- `eda.json`: `numeric_hist`, `categorical_counts`, `group_means`, `scatter`, `binned_means`, `data_quality`.
- `correlations.json`: `table`, `matrix`.
- `models.json`: `final_table`, `cv`, `tuning`, `selected_model`, `selection_rule_text`, `target_status`.
- `importance.json`: `permutation`, `coefficients`, `tree`, `note`.
- `errors.json`: `summary`, `by_actual_range`, `by_predicted_range`, `by_group`, `largest_errors`, `histogram`.
- `test_points.json`: `actual`, `predicted`, `residual`, `Attendance`, `Hours_Studied`, `Previous_Scores`, `Motivation_Level`, plus sample metadata.
- `viva.json`: array of `{group, question, answer}` parsed from the viva source.

### FE_02/FE_03 must know

- This is Path A: `predictor.js` is a pure ES module that imports `data/model_spec.json`; serve the frontend locally over HTTP (no Python prediction server is required).
- FE_02 should keep the prediction module's named exports: `predict`, `predictBatch`, `sweep`, `describeInputIssues`.
- FE_03 must read displayed metrics from the JSON files above; the target is `Exam_Score`, and stress level, screen time, and CGPA are not dataset columns.

## FE_02 — Design system and app shell

- Status: Complete. All FE_02 work is confined to `frontend/`; no ML source files or exported JSON files were changed.
- The shell uses the exact FE_00 dark/light color tokens, type stacks, spacing, radii, shadows, z-index and motion scales. Additional `--amber-text` and `--teal-text` variables preserve the required accent tokens while keeping small accent text accessible in light mode. Light chart series are `#8B5E00`, `#0E8F82`, `#C2414B`, `#2F67B2`, and `#766647`; dark series use the specified amber, teal, rose, sky, and sand colors.
- Contrast checks: light text amber 5.13:1 and teal 5.16:1; dark amber 10.57:1 and teal 9.91:1. Light chart teal and rose are 3.60:1 and 4.57:1 against the page background. Chart series also use axes, labels, and markers rather than color alone.
- Offline font check blocked Google Fonts requests and confirmed the fallback stacks remain `DM Sans, system-ui, sans-serif` and `Fraunces, Georgia, serif`.

### FE_02 files

- `css/tokens.css`, `css/base.css`, `css/components.css`
- `index.html`
- `js/main.js`, `js/data.js`, `js/ui.js`, `js/charts.js`
- `js/pages/home.js`, `playground.js`, `explorer.js`, `models.js`, `importance.js`, `errors.js`, `method.js`, `viva.js` (real-title skeleton stubs)
- `js/pages/gallery.js` (dev-only shared-component gallery)
- `vendor/chart.umd.min.js` (local Chart.js 4.4.8)

### Shared UI and page contract

- Components are page-independent and use shared classes: `.topbar`, `.primary-nav`, `.mobile-nav`, `.more-sheet`, `.theme-toggle`, `.button` variants, `.card`, `.metric-card`, `.segmented`, `.range-control`, `.chip-group`, `.callout` variants, `.table-wrap` / `.data-table`, `.tabs`, `.tooltip-trigger` / `.tooltip`, `.toast-region` / `.toast`, `.skeleton`, `.stat-pill`, `.chart-frame`, `.empty-state`, and `.error-card`.
- Page modules export `render(container, ctx)` and `destroy()`. The router lazy-loads each of the eight route modules, invokes the previous page's `destroy()`, updates page title/navigation/history, focuses `<main>`, and displays an error card on page failures. The gallery is available only at `?dev=1#/gallery`.
- `ui.js` exports `formatNumber`, `formatPercent`, `formatMarks`, `animateNumber`, `el`, `createTabs`, `createSegmented`, `tooltip`, `toast`, `copyToClipboard`, and `observeInView`.
- `charts.js` exports `applyChartTheme`, `makeBar`, `makeScatter`, `makeLine`, `makeHistogram`, `makeHeatmap`, and `toDataTable`. Chart titles and both axis labels are required. Charts include accessible data tables and re-theme on `themechange`; when Chart.js is blocked, the notice and data-table fallback appear.
- `data.js` provides cached `loadJSON`, typed `DataLoadError`, and `loadAll`; startup loads `meta.json` and `model_spec.json`. Theme choice is persisted locally, and first visit follows the system preference before paint.

### Verification

- `node --check` passed for all 14 JavaScript files; CSS contains no `!important`.
- Browser verified all eight routes and page titles, direct hash navigation, dev gallery, theme persistence after reload, skip-link focus, arrow-key tab/segmented controls, table toggle/sort, tooltip keyboard reveal, and mobile More-sheet open/Escape close.
- Gallery checked at 360, 768, and 1280 CSS pixels: no horizontal overflow; mobile navigation is shown below 820px and hidden at desktop width. Screenshots were visually checked at 360px and 1280px in both themes.
- Normal browser route sweep reported no console errors/warnings. Blocking Chart.js produced the visible fallback notice and accessible table. Blocking Google Fonts preserved the system fallback stacks.

### FE_03 must know

- The shell and shared UI are ready; the eight page modules are intentionally skeletons, and FE_03 owns the first real page content.
- Keep page logic inside its module and destroy chart/observer/listener resources when leaving a page. Route context supplies `loadJSON`, `loadAll`, `el`, and `toast`.
- Import prediction functions from `js/predictor.js` only where needed. Preserve its public exports and show saved JSON values only; keep `Exam_Score` as the target and visibly note that stress level and screen time are not dataset columns.
- Continue serving from `frontend/` over HTTP. Do not edit the ML project or generated `frontend/data/*.json`.

## FE_03 — Home, Predict, Models

- Status: Complete. All page work is under `frontend/`; ML source files and the nine exported JSON files remain unchanged.
- Home reads `meta.json`, `model_spec.json`, and `importance.json`. Its four metric cards use the exported row counts, model, test R², and MAE. The three findings follow the permutation-importance ranking. Dataset URL and license remain explicitly marked as unconfirmed.
- Predict reads `meta.json`, `model_spec.json`, `eda.json`, and `test_points.json`, and calls the existing Path A predictor. Its 19 controls (6 numeric, 13 categorical) are generated from `features_used`; the three missing-value categories expose the model's imputation behavior. Presets A/B/C display 79.1, 66.3, and 51.9 to one decimal.
- The Predict URL uses `h`, `a`, `s`, `p`, `t`, `pa`, `pi`, `ar`, `ml`, `fi`, `tq`, `peer`, `pe`, `d`, `ex`, `ia`, `st`, `ld`, and `g` for the current profile. `sc` stores up to three scenarios as JSON. Invalid numeric/category values and malformed scenarios are ignored safely.
- The score histogram in `eda.json` describes the full cleaned dataset. The page subtracts the 1,322 held-out `test_points.actual` values to reconstruct 5,284 training rows; it checks the total and labels the fallback histogram accurately if reconstruction cannot be verified.
- Models reads `models.json` and `meta.json`. The comparison table sorts by column and highlights LinearRegression; chart tabs show CV R² (including standard-deviation error bars), held-out Test R², and MAE/RMSE, with the 0.75 target line where applicable. The training-vs-CV overfit view is hidden because `final_table` contains no training R² values. Tuning cards retain the exported parameter grids, best parameters, CV scores, and recorded gaps.
- FE_03 implementation files: `css/pages.css`, `index.html`, `js/charts.js`, `js/main.js`, `js/pages/home.js`, `js/pages/playground.js`, `js/pages/models.js`, and `js/ui.js`.

### FE_03 verification

- `node --check` passed for all 14 JavaScript files.
- `python frontend/tests/schema_check.py`: passed for all nine JSON exports.
- `python frontend/tests/parity_test.py`: passed; maximum Python/JS difference was `4.26325641456e-14`.
- Home metric values and the top three findings were checked against their JSON sources. Preset scores matched the predictor to displayed precision.
- Browser checks covered all three pages at 360, 768, and 1280 CSS pixels in both themes. The 18 screenshots were visually reviewed; no document-level horizontal overflow remained. At 360px, the Models comparison table scrolls within its own wrapper.
- Predict checks covered the 19 generated controls, unknown-category imputation warnings, typed out-of-range indicators, 0–100 display clipping, keyboard slider/radio navigation, reduced-motion and focus-paused Home gauge behavior, and reuse of the sweep chart instance during input updates.
- Keyboard activation of presets, saving two scenarios, copying the URL, and reloading restored the same profile and both scenarios. Invalid URL values fell back to the typical profile. The generated CSV Blob was inspected (model/date comment, header, feature columns, and scenario rows); the integrated browser did not expose a download event.
- Models checks covered all four candidate rows, sorting, both R² target lines, CV error bars, the MAE/RMSE chart, tuning labels, target-status values, and the absent overfit view. A normal reload and route sweep produced no console errors or warnings.

### FE_04 must know

- Keep `frontend/data/*.json` and ML source files read-only; continue using the local frontend server. This is Path A, so the frontend does not require a Python prediction service.
- `css/pages.css` is linked from `index.html` and owns the Home, Predict, and Models layouts. `charts.js` supports per-chart plugins and refreshes its accessible data table when chart data updates.
- `predictor.js` exports remain unchanged. The `explore`, `importance`, `errors`, `method`, and `viva` pages remain FE_04 work; preserve the shared route/page contract and destroy chart/listener resources on navigation.

## FE_04 — Explore, Importance, Errors, Method, Viva

- Status: Complete. FE_04 changes are confined to the frontend page modules, shared chart styling, page CSS, the number audit, and this handoff. ML source files and exported JSON remain read-only.
- Explore reads `eda.json`, `correlations.json`, `meta.json`, and `model_spec.json`; it provides the dataset overview, distributions, relationships, correlations, and group summaries.
- Importance reads `importance.json`; permutation and coefficient views are available. The tree-method toggle is omitted because `importance.json.tree` is empty. The low-value threshold and non-causal interpretation are shown.
- Errors reads `errors.json` and `test_points.json`; it provides held-out metrics, filtered/pinnable actual-vs-predicted points, residuals, score-range/group breakdowns, largest errors, and the recorded interpretation. Group residual means are not exported, so the UI marks them unavailable rather than deriving or inventing them.
- Method reads `meta.json`, `models.json`, and `eda.json`; it presents the 19-step workflow, leakage safeguards, dataset facts, limitations, reproduction commands, and references. Dataset URL, author, license, and access date remain unconfirmed, as recorded in the source metadata.
- Viva reads `viva.json` and `meta.json`; it provides data-driven topic/search filters, flashcards, quiz self-rating, review queue, keyboard controls, and local progress persistence. Q5 uses the metadata target statistics instead of inconsistent rounded values in the saved answer.
- FE_04 implementation files: `css/pages.css`, `js/charts.js`, `js/pages/explorer.js`, `js/pages/importance.js`, `js/pages/errors.js`, `js/pages/method.js`, and `js/pages/viva.js`. Shared chart theme updates preserve explicitly specified dataset colors.

### FE_04 verification

- `node --check` passed for all 14 JavaScript files.
- `python frontend/tests/schema_check.py`: passed for all nine JSON exports (635,091 bytes total).
- `python frontend/tests/parity_test.py`: passed; maximum JS/Python prediction difference was `4.26325641456e-14`.
- `tests/number_audit.md` contains 52 checked display values: 10 each for Explore, Importance, Errors, and Viva, and 12 for Method; all are marked matching.
- Browser route lifecycle test: five visits to each FE_04 route yielded stable chart instance counts (Explore 0, Importance 1, Errors 3, Method 0, Viva 0), with no page errors or console errors. Errors residual toggling retained the breakdown chart; explicit coefficient/error colors and Viva progress persistence were also checked.
- Responsive sweep covered all 30 combinations (five pages × 360/768/1280 px × light/dark); no document-level horizontal overflow or browser errors were observed. Mobile-dark screenshots were visually reviewed for all five pages. The full 30-combination screenshot review requested by FE_04 was not completed.
- The displayed-text scan found none of the forbidden causal phrases (`causes`, `leads to`, `improves`, `boosts`, `guarantee`). `CGPA` appears only in explicit explanatory/disclaimer context, not as the prediction target.

## FE_05 — Polish, QA, accessibility, and docs

- Status: Complete with the unverified items below explicitly recorded. Work is confined to the frontend and this handoff; no ML source files were intentionally changed. The FE_05 exporter writes only the nine generated JSON exports under `frontend/data/`.
- Added purpose/input/output header comments to the 14 frontend JavaScript modules. Updated wording to avoid causal claims, standardized the displayed R²/MAE/RMSE precision, added slider `aria-valuetext` with singular/plural tutoring-session text, and marked the Viva flashcard faces as hidden when not presented. Error and model chart/table outputs use the same rounded values as their UI metrics.
- Added `FRONTEND_README.md`, `tests/DEMO_SCRIPT.md`, `tests/ui_checklist.md`, and expanded `tests/number_audit.md` to include Home, Predict, and Models values.
- Added QA screenshots under `tests/screenshots/`. The integrated browser captured Home at 1280 px and Viva at 360 px; other captures used the browser's narrower effective viewport. They are illustrations, not formal viewport certificates.

### FE_05 verification

- `python frontend/export_data.py`: passed; regenerated all nine frontend JSON files.
- `python frontend/tests/schema_check.py`: passed; all required JSON fields and finite values checked; total JSON size 635,091 bytes.
- `python frontend/tests/parity_test.py`: passed; maximum Python/JavaScript prediction difference `4.26325641456e-14` (tolerance `1e-6`); six engineered columns matched the saved test CSV.
- `node --check` passed for all 14 JavaScript files.
- Browser sweep covered eight routes × 4 widths (360, 768, 1280, 1920) × 2 themes = 64 cases. No document-level horizontal overflow, missing/extra H1, or console errors were found.
- Browser checks verified theme persistence and live re-theming (three Errors charts remained mounted), tutoring slider text for values 0/1/2, Models target and metric formatting, and the missing-Chart.js state (warning plus three accessible data tables). The earlier missing-JSON test showed a friendly error and `python export_data.py` hint.
- Copy scan across `index.html` and `js/pages/*.js` found no forbidden causal/promise language, unsupported deployment claims, `innerHTML`, `console.log`, or TODO markers. `CGPA` appears only as an explicit non-target clarification; Home and Method mention that stress and screen time were not measured. External links opened in a new tab use `rel="noopener noreferrer"`.
- Performance observed in one local Chromium run: Home heading 222 ms; first-page readiness 708 ms; 1,117,900 response-body bytes across 29 local/external responses (1,111,337 encoded resource bytes); largest JSON `eda.json` 419,849 bytes; 20 simulated slider updates 194 ms. Only external origin observed was `fonts.googleapis.com`; prediction and project data remain local.
- Manual contrast sample results: dark body 14.91:1, dark muted 7.50:1, dark amber 10.57:1, dark teal 9.91:1; light body 14.91:1, light muted 5.40:1, light amber 5.13:1, light teal 5.16:1, light rose 4.57:1. These are sampled text/background pairs, not a complete automated accessibility score.
- The VS Code test provider had no runnable test suite; validation used the repository scripts and browser tests. No formatter, linter, axe, or Lighthouse score was run.

### FE_05 limitations and follow-up

- Chromium only; Firefox was not tested. The browser's viewport changed back to its narrower default after some route changes, so not every screenshot corresponds to the requested desktop dimensions.
- 200% browser zoom, text-only enlargement, a full keyboard-only tour of all eight pages, a complete screen-reader test, and a visual Windows forced-colors audit remain unverified. The `forced-colors` media query was emulated but not visually certified.
- CSV Blob content was inspected, but the browser tool did not expose a native download event. The mobile/desktop placement of the permanent Predict disclaimer was not separately verified at final QA.
- The baseline SHA-256 list captured earlier was not persisted in a reusable file. The exporter was rerun and is scoped to read project artifacts/write frontend JSON, but an exact pre-existing hash comparison cannot be reproduced from the retained handoff.
- Source attribution remains unresolved: confirm the Kaggle URL, author, license, and access date in the original project/source before external reuse. No ML project README or source artifact was edited here.
- Block 09 was not implemented; it is outside the user's current scope. The completed Path A frontend remains the only frontend in this workspace.
