# Study Lab — Optional Frontend

Study Lab is a local, optional frontend extension for the Exam Stress & Student
Performance Correlator college project. It visualizes the project's saved
analysis and reproduces its already-fitted LinearRegression model in the
browser (Path A). It does not retrain the model or modify the submitted ML
project.

> **Honesty note:** the prediction targets `Exam_Score`, not CGPA. Stress level
> and screen time are not in the dataset. Correlation, model prediction, and
> causation are different things. A profile estimate is not a real exam result,
> study advice, or evidence that changing a feature changes an outcome.

## Screenshots

Selected captures are in [`tests/screenshots/`](./tests/screenshots/):

- `home-light.png` — Home and saved-model summary.
- `predict-dark.png` — local model predictor and what-if controls.
- `errors-dark.png` — held-out error analysis.
- `explore-light.png` — dataset exploration.
- `viva-mobile-light.png` — Viva practice at a narrow viewport.

These are QA captures, not product assets. Browser automation ran in Chromium;
capture viewport sizing varied with the integrated browser, so use them as
illustrations rather than proof of a particular physical display size.

## Requirements and startup

- Python and the packages pinned in the project-root `requirements.txt` are
  required to regenerate the JSON exports. That requirements file documents
  Python 3.14+ as its compatible environment.
- A modern browser with JavaScript modules and JSON module imports.
- Node.js is used only by the optional Python/JavaScript parity test.
- No build step, prediction server, account, database, or external API is used.

From the project root, run these PowerShell commands:

```powershell
Set-Location frontend
python export_data.py
python -m http.server 8000
```

Then open <http://localhost:8000>. Keep the server running while using the
frontend; press `Ctrl+C` in its terminal to stop it.

## Folder tour

```text
frontend/
├── index.html                 App shell and local router entry point
├── css/                       Theme tokens, shared components, page styles
├── js/
│   ├── main.js                Router, theme, startup and error handling
│   ├── data.js                Cached local JSON loader
│   ├── predictor.js           Path A preprocessing and prediction
│   ├── charts.js              Chart.js wrappers and accessible data tables
│   ├── ui.js                  Shared DOM, formatting, tabs and feedback
│   └── pages/                 Eight user pages plus a dev-only gallery
├── data/                      Nine generated JSON files; do not hand-edit
├── vendor/chart.umd.min.js    Local Chart.js 4.4.8 bundle
├── export_data.py             Reads saved project artifacts; writes data/*.json
├── tests/
│   ├── parity_test.py         Optional Python/JavaScript saved-model comparison
│   ├── schema_check.py        Required JSON keys, finite values, size check
│   ├── number_audit.md        Displayed-number source audit
│   ├── ui_checklist.md        QA evidence and verification limits
│   ├── DEMO_SCRIPT.md         Five-minute faculty-demo notes
│   └── screenshots/           QA-only captures
└── FRONTEND_STATE.md          Implementation and verification handoff
```

## Data flow

```text
Saved ML outputs and permitted source data (read-only)
                 |
                 v
       frontend/export_data.py
                 |
                 v
       frontend/data/*.json
                 |
       +---------+----------+
       |                    |
       v                    v
 Eight local pages     predictor.js + exported model_spec.json
                            |
                            v
                  Browser-side estimate
```

The exporter reads the saved model and the project's existing CSV/JSON/report
artifacts. It writes only the nine JSON files under `frontend/data/`. The
frontend pages consume those exports; user inputs and predictions stay in the
browser. There is no API call for prediction.

## How a prediction works

1. The page loads the exported `model_spec.json` containing the fitted
   preprocessing and linear-model parameters.
2. Numeric and categorical values are collected from the profile controls.
3. Missing categorical values use the exported imputation modes; unsupported
   categories are rejected.
4. Numeric inputs are standardized with the saved scaler values, and ordinal
   inputs are encoded using the exported category order.
5. The browser applies the saved coefficients and intercept, then displays the
   estimate with the project's uncertainty summaries and range warnings.
6. The result is compared with saved example profiles and can be explored with
   local what-if sweeps. No model is fitted or changed.

`python tests/parity_test.py` compares JavaScript results with the saved Python
model for seeded held-out rows, presets, and missing-category cases. The latest
run passed with maximum absolute difference `4.26325641456e-14`, below the
`1e-6` tolerance. It also checks the six exported engineered-feature columns
against `test.csv`.

To refresh after the ML project is intentionally retrained, regenerate the
exports with `python export_data.py`, then run
`python tests/schema_check.py` and `python tests/parity_test.py`. Do not edit the
generated JSON manually.

## Page tour and data sources

| Page | What it shows | JSON sources |
|---|---|---|
| Home | Saved project metrics, example profiles, permutation-importance findings | `meta.json`, `model_spec.json`, `importance.json` |
| Predict | Saved-model profile estimates, uncertainty, input warnings, scenarios, and what-if sweeps | `meta.json`, `model_spec.json`, `eda.json`, `test_points.json` |
| Explore | Dataset quality, distributions, relationships, correlations, and summaries | `eda.json`, `correlations.json`, `meta.json`, `model_spec.json` |
| Models | Candidate comparison, CV/test/error charts, tuning records, and target status | `models.json`, `meta.json` |
| Importance | Permutation importance and standardized coefficients | `importance.json` |
| Errors | Held-out metrics, residuals, score bands, groups, and largest misses | `errors.json`, `test_points.json` |
| Method | Project workflow, evaluation safeguards, limitations, and references | `meta.json`, `models.json`, `eda.json` |
| Viva | Saved questions, flashcards, quiz self-rating, and local practice progress | `viva.json`, `meta.json` |

Unavailable source fields are shown as unavailable or explicitly omitted; the
frontend does not invent missing tree importance or group residual statistics.

## Accessibility and browser notes

The final QA run used Chromium. It covered eight routes across 360, 768, 1280,
and 1920 CSS-pixel widths, in both themes: 64 route/theme/width combinations
with one H1 per page, no document-level horizontal overflow, and no browser
console errors. A manual contrast sample against the page backgrounds measured:

| Pair | Contrast |
|---|---:|
| Dark body text / dark page | 14.91:1 |
| Dark muted text / dark page | 7.50:1 |
| Dark amber text / dark page | 10.57:1 |
| Dark teal text / dark page | 9.91:1 |
| Light body text / light page | 14.91:1 |
| Light muted text / light page | 5.40:1 |
| Light amber text / light page | 5.13:1 |
| Light teal text / light page | 5.16:1 |
| Light rose text / light page | 4.57:1 |

Route changes focus `<main>`. The predictor sliders expose descriptive
`aria-valuetext`, including singular/plural tutoring-session labels. Chart
canvases have image labels, and their data-table alternatives remain available.
With Chart.js blocked, accessible fallback tables appeared for the three Errors
charts. Reduced-motion styles, focus styles, keyboard-operated tabs/controls,
and the native More dialog's Escape behavior were checked. This was not a
complete screen-reader or keyboard-only audit, and no automated axe/Lighthouse
score was collected.

200% browser zoom, Firefox, and a full Windows high-contrast visual audit were
not verified. The integrated browser confirmed the forced-colors media query
can be emulated, but that is not a substitute for a visual high-contrast test.

## Performance and network observations

In the local Chromium run, the Home heading appeared in 222 ms and initial page
readiness was 708 ms. Observed browser response bodies totalled 1,117,900 bytes
across 29 responses (encoded resource sizes totalled 1,111,337 bytes); the
largest JSON was `eda.json` at 419,849 bytes. The nine frontend JSON exports
total 635,091 bytes. Twenty simulated slider updates completed in 194 ms.
These are measurements from one local run, not guarantees for other machines.

The only external origin observed was `fonts.googleapis.com` for optional
typography. App scripts, charts, predictions, and exported data are served
locally; no project data is sent to that font host or to an API. System-font
fallbacks remain available if fonts cannot load.

## Limitations and credits

- The dataset URL, author attribution, license, and access date remain marked
  for student confirmation in the exported metadata. Verify these details
  before external reuse or making a license claim.
- `viva.json` contains the 45 numbered Q1–Q45 entries found in the source
  report; its introduction's claim of 52 questions does not match the saved
  question/answer headings.
- Per-fold R² values, tree-importance rows, and exported group mean residuals
  are unavailable. Corresponding views are omitted or labelled accordingly.
- The app is local-only and is not a deployment, online service, live student
  monitor, or causal analysis.
- The local chart bundle is Chart.js 4.4.8 (MIT). The referenced Google Fonts
  families are DM Sans, Fraunces, and JetBrains Mono, supplied by Google Fonts;
  verify the applicable font license details before redistribution.
- The Kaggle dataset reference is present, but its URL and attribution details
  have not been verified by the student.

### Optional README snippet

```markdown
## Optional frontend
Run `cd frontend`, `python export_data.py`, then `python -m http.server 8000` and open http://localhost:8000.
This local extension reads saved project outputs; it does not modify or retrain the submitted ML project.
```
