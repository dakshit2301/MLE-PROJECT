# End-to-End Test Report

**Verdict: NOT FULLY VERIFIED — Critical 0, Major 0, Minor 2; visual PDF
validation and several manual accessibility/browser checks remain NOT TESTED.**
Runnable data, model, startup, and core frontend checks passed. The two confirmed
findings are documentation/provenance follow-ups, not runtime failures. This was
a test-only audit: no existing project files were changed.

## 1. Environment and startup

- OS: Windows 11 build 26300 (`Microsoft Windows NT 10.0.26300.0`).
- Python: 3.14.6.
- Installed packages: pandas 3.0.5, numpy 2.5.2, scikit-learn 1.9.0, scipy
  1.17.1, matplotlib 3.11.1, seaborn 0.13.2, joblib 1.5.3, uvicorn 0.54.0.
  FastAPI is not installed.
- The repository contains one frontend: `frontend/`, the existing Path A
  JavaScript app. No Python API/backend entry point was found. Block 09 was
  explicitly excluded by the user.
- ML notebook:
  `notebook/exam_stress_performance_correlator.ipynb`.
- ML project startup instructions in `README.md`: install
  `requirements.txt`, start Jupyter, set the notebook kernel working directory
  to `notebook/`, then run all cells. The notebook's relative paths target
  `../data`, `../charts`, and `../outputs`.
- Frontend startup instructions in `frontend/FRONTEND_README.md`: from project
  root, `Set-Location frontend`, `python export_data.py`,
  `python -m http.server 8000`; open `http://localhost:8000`.
- Backend/API startup and API tests: Not applicable; no backend/API was found.
- Notebook execution was attempted only in an isolated copy under
  `qa_tests/tmp/`, not in the original project.

## 2. Phase results

| Test ID | What was tested | Result | Evidence |
|---|---|---|---|
| P0-01 | Project tree, notebook/data/outputs/charts/reports/readmes/requirements inventory | PASS | Tree to depth 2 inspected; listed required directories and notebook found. |
| P0-02 | Read project and frontend run instructions/state | PASS | `README.md`, `outputs/PROJECT_STATE.md`, `frontend/FRONTEND_README.md`, `frontend/FRONTEND_STATE.md` inspected. |
| P0-03 | Python/OS/package versions | PASS | Environment output recorded above; FastAPI absent. |
| P0-04 | Backend and frontend discovery | PASS | No backend entry point; one Path A frontend; no Block 09 app. |
| P1 | File inventory, sizes, and source-dataset byte hash | PASS | All specified ML artifacts were non-empty; exact list checked by filesystem; raw CSV SHA-256 matched the original source CSV. |
| P2 | Data integrity, leakage, reproducibility copy, independent metrics, model prediction, wording | PASS | Data integrity and notebook copy/reproducibility passed; the fresh QA environment also passed isolated model prediction parity. |
| P3 | Fresh virtual environment / dependency install | PASS | Requirements installed under `qa_tests/tmp/`; `pip check` reported no broken requirements. |
| P4 | Backend/API tests | NOT APPLICABLE | No backend/API exists in this project. |
| P5 | Frontend end-to-end tests | PARTIAL | All eight routes loaded with one H1 and no overflow at the harness default; Home, Predict, and Errors also passed standalone 1440×900 and 390×844 checks with screenshots. Browser persistence, 200% zoom, Firefox, and exhaustive screen-reader checks remain unverified. |
| P6 | Cross-check report/README/notebook/output/UI numbers and PDF | PARTIAL | Model/data numbers agree at displayed precision. PDF text/pages/images were checked; visual clipping could not be checked because no PDF renderer was available. Two documentation findings are recorded below. |
| P7 | Negative/edge tests, secrets and path scan | PASS | Malformed JSON, alternate port/directory, heuristic secret/path scan, and 96-file baseline comparison completed. Negative tests used only a copy under `qa_tests/tmp/`. |

## 3. Findings

| # | Severity | File(s) | Finding | Evidence | Confidence |
|---|---|---|---|---|---:|
| 1 | Minor | `README.md:72`; `reports/viva_questions.md:4`; `frontend/data/viva.json` | The documented viva-question totals disagree. README says 50, the viva introduction says 52, while the source contains 45 numbered questions across nine question groups, the frontend export contains 45, and the UI reports 45 saved questions. | Counted numbered questions and exported entries; confirmed 45 in the browser. | 10/10 |
| 2 | Minor | `frontend/data/meta.json:7-10`; `README.md:28` | Dataset provenance is incomplete and inconsistent: the generated metadata still has placeholder URL, author, license, and access date, while README supplies an access date (`2026-10-25`) that has not been confirmed against that metadata. | Read the exported metadata and README; the UI labels the Kaggle URL/license as unconfirmed. | 9/10 |

## 4. Numbers-must-match table

| Metric | Independently checked / saved output | README and report | Frontend UI | Result |
|---|---:|---:|---:|---|
| Raw / cleaned rows | 6,607 / 6,606 | 6,607 / 6,606 | 6,606 cleaned | Match |
| Train / held-out test rows | 5,284 / 1,322 | 5,284 / 1,322 | 5,284 / 1,322 | Match |
| Final model | LinearRegression | LinearRegression | LinearRegression | Match |
| CV R² (mean ± SD) | 0.7171 ± 0.0731 | 0.7171 ± 0.0731 | 0.717 | Match at UI precision |
| Test R² | 0.8257919965 → 0.8258 | 0.8258 | 0.826 | Match at displayed precision |
| Test MAE | 0.4102771336 → 0.4103 | 0.4103 | 0.41 | Match at displayed precision |
| Test MSE | 2.3037647936 → 2.3038 | 2.3038 | Not shown | Match |
| Test RMSE | 1.5178157970 → 1.5178 | 1.5178 | 1.52 | Match at displayed precision |
| Held-out p90 absolute error | 0.6424 | 0.6424 | 0.64 marks | Match at displayed precision |
| Test R² target | 0.75; test met, CV below target | Same | Same status text | Match |

## 5. Student manual to-do list

The initial README and report reads show institution/team placeholders and
dataset-source details needing student confirmation; see the numbered
follow-up list below for the confirmed manual actions.

1. Replace the four team-member name, enrolment-number, and contribution
   placeholders in `README.md` (lines 14–17).
2. Confirm the dataset's canonical source URL, author attribution, license, and
   access date. Reconcile README's access date with the still-unfilled
   `frontend/data/meta.json` fields before submission.
3. Decide whether the intended viva set is 45, 50, or 52 questions; update the
   README and viva introduction, or add missing source questions and export
   entries so all totals agree.
4. Keep the report's ±1.5-mark confidence-interval language clearly scoped as a
   future enhancement. The current UI displays empirical MAE/RMSE/p90 error
   summaries, not prediction confidence intervals.

## 6. Demo-day checklist

1. From the project root, run `Set-Location frontend`, then
   `python export_data.py`.
2. Start the static app with `python -m http.server 8000`; open
   `http://localhost:8000`.
3. Show Home's dataset/model/held-out metrics and explicit target and
   non-causality notes.
4. In Predict, demonstrate the Student A/B/C presets and explain that outputs
   are saved-model estimates, not real exam outcomes.
5. In Explore, Models, Importance, and Errors, explain the saved charts/tables
   and distinguish CV results from the held-out test result.
6. In Viva, show the 45-question export and its nine topic groups.
7. State that the frontend is local/static Path A; there is no prediction API
   or backend in this project.

Unverified demo precautions: test the actual presentation computer/browser,
keyboard-only use, 200% zoom, and screen-reader behavior before presenting.

### Phase 1 — inventory details

Every requested data input (`raw_dataset.csv`, `cleaned_dataset.csv`,
`train.csv`, `test.csv`), the notebook, requested chart set (target
distribution, correlation heatmap, study/sleep/motivation/attendance charts,
actual-vs-predicted, residual, feature importance), requested output set
(validation, data quality, correlation, feature configuration, CV, tuning,
comparison table, saved model, test predictions, error analysis, importance),
`reports/viva_questions.md`, `reports/final_report.md`, `final_report.pdf`,
`README.md`, and `requirements.txt` exists and is non-empty.

The repository-root `Student Performance Factors.csv` and `data/raw_dataset.csv`
are byte-identical: SHA-256
`E8DF8C4148EF83FB295CA1C092F2C6EE15272C0A8E3018B769A788AB50E96E97`.

### Phase 2 — ML integrity and saved results

- Data facts: raw 6,607 × 20, score range 55–101; exactly one invalid score
  (101) was removed. Cleaned data is 6,606 × 20, equals the original rows
  after that single removal, retains all 235 missing cells (78
  `Teacher_Quality`, 90 `Parental_Education_Level`, 67
  `Distance_from_Home`), and contains zero duplicate rows.
- Split: 5,284 training and 1,322 test rows (79.988% / 20.012%); 26 columns
  identical and ordered in each split; no full-row overlap; split sizes sum to
  the cleaned set.
- Notebook leakage scan: split occurs at notebook cell 104; the training
  preprocessor is a scikit-learn `Pipeline`; candidate selection is pre-
  committed using CV before cell 162 loads `data/test.csv`. The saved notebook
  self-test asserts there is exactly one `test.csv` read (cell 176). Test
  predictions and final metrics are computed after that single load. No
  feature-derivation from `Exam_Score` was found in the feature definitions.
- Reproducibility: executed the notebook in `qa_tests/tmp/copy/` with
  `nbconvert`; 120 code cells executed and there were no stored error outputs.
  Regenerated `final_comparison_table.csv`, `test_predictions.csv`, and
  `tuning_results.json` matched the originals exactly for all compared values
  (maximum numerical difference 0). Shutdown emitted scikit-learn parallel
  deprecation warnings and joblib resource-tracker `KeyError` traces, but the
  notebook completed and all saved outputs matched.
- Independent metrics from `test.csv` and `test_predictions.csv`: MAE
  0.410277133550, MSE 2.303764793630, RMSE 1.517815797002, R² 0.825791996524.
  The comparison table stores four decimals (0.4103, 2.3038, 1.5178, 0.8258);
  each independently recomputed value rounds to its stored value.
- Saved model in a normal fresh Python process predicted the first 20 test
  rows within `7.11e-15` of `final_model_pred`. The initial isolated process
  lacked `python-dateutil`; after installing `requirements.txt` in the clean QA
  virtual environment, `python -I` loaded the model and reproduced the first
  20 predictions within `7.11e-15`.
- Target status is test R² 0.8258 vs target 0.75 (met); CV R² 0.7171 (below
  target). README, report, and UI communicate the same values at their
  respective rounding precision.
- Wording scan found “causes” only in the notebook's explicit prohibition
  example and “proven causes” in a limitation statement; UI mentions of CGPA
  clarify that it is not the target. No UI causal/promise claim was found.

### Phase 3 — isolated environment

- Created `qa_tests/tmp/venv` with Python 3.14.6 and installed the pinned
  `requirements.txt` dependencies, including pandas 3.0.5, NumPy 2.5.2,
  scikit-learn 1.9.0, SciPy 1.17.1, Matplotlib 3.11.1, seaborn 0.13.2,
  joblib 1.5.3, nbconvert 7.17.1, and ipykernel 7.3.0.
- `python -m pip check`: “No broken requirements found.”
- In isolated mode (`python -I`), loaded `final_model.joblib`, predicted all
  1,322 test examples, obtained finite results, and matched the first 20 saved
  predictions within `7.11e-15`.

### Phase 5 — frontend end-to-end checks

- Smoke-tested `home`, `predict`, `explore`, `models`, `importance`, `errors`,
  `method`, and `viva`. Each rendered its expected title and exactly one main
  H1. At the integrated browser's default 778×486 viewport, document width was
  768px and no horizontal overflow, page errors, console errors, or failed
  requests were observed.
- Independently set and verified each of Home, Predict, and Errors at
  1440×900 and 390×844. All six checks reported no horizontal overflow (the
  document widths were 1,430px and 380px respectively). Full-page captures are
  in `screenshots/frontend/`:
  [Home 1440](./screenshots/frontend/home-viewport-1440x900-fullpage.png),
  [Home 390](./screenshots/frontend/home-viewport-390x844-fullpage.png),
  [Predict 1440](./screenshots/frontend/predict-viewport-1440x900-fullpage.png),
  [Predict 390](./screenshots/frontend/predict-viewport-390x844-fullpage.png),
  [Errors 1440](./screenshots/frontend/errors-viewport-1440x900-fullpage.png),
  [Errors 390](./screenshots/frontend/errors-viewport-390x844-fullpage.png).
  PNG raster widths differ from CSS viewport widths due to device scale and
  scrollbar sizing; the dimensions above are runtime `innerWidth`/`innerHeight`
  measurements, not image pixel dimensions.
- At 1440px, Home showed primary navigation; at 390px, it showed mobile
  navigation. Home metrics animated to 6,606, 0.826, and 0.41 when scrolled
  into view.
- Keyboard-activated Predict presets matched saved values: Student A 79.1,
  Student B 66.3, Student C 51.9. The tutoring range exposed
  `aria-valuetext="1 tutoring session"` at the default profile. Pointer-click
  automation was unreliable because the integrated browser reported
  overlapping page elements; do not treat pointer automation as verified.
- The Viva page reported 45 saved questions in nine topic groups and exposed
  labelled search/filter/practice controls. Earlier FE_05 checks also exercised
  chart/table tabs and the chart-library fallback; these are supporting prior
  checks, not a full screen-reader or browser-compatibility audit.
- A full route × viewport × theme matrix was not considered reliable because
  the integrated browser reset viewport dimensions during route transitions.
  Firefox, 200% zoom, native CSV download events, exhaustive keyboard traversal,
  and full screen-reader behavior remain NOT TESTED.

### Phase 6 — documents and PDF

- The comparison table above reconciles the raw output values with README,
  Markdown/HTML report, and UI display precision. Independent metrics round to
  the saved four-decimal values; UI rounding is consistent.
- `final_report.pdf` has 14 A4 pages, 21,845 extractable text characters, three
  embedded images, and all four headline metrics (test R², CV R², MAE, RMSE).
  No PDF rendering utility was available, so table clipping and visual layout
  are NOT TESTED.
- Question-count mismatch and unresolved data provenance are the two findings
  listed above. The ±1.5-mark confidence-interval statement is in the report's
  future-enhancement list; it is not implemented as a current UI capability.

### Phase 7 — negative checks, scan, and change control

- Served a copy of `frontend/` from port 8001 while the process working
  directory was the project root, using
  `python -m http.server 8001 --directory qa_tests/tmp/frontend-edge`.
  The copied app returned HTTP 200 and rendered Home, confirming alternate-port
  and explicit-directory startup.
- Intercepted `data/meta.json` on that copied app with malformed JSON. The app
  displayed its Page error view and `python export_data.py` recovery
  instructions; no uncaught page error or failed request occurred.
- Heuristic scan of project text files found no common AWS/GitHub/API-key or
  private-key patterns, credential assignments, or user-profile path strings.
  This is a pattern scan, not a guarantee that all possible secrets are absent.
- Recalculated SHA-256 for the 96 files in the pre-audit manifest: zero missing,
  zero changed. Existing project files were preserved; only the report and
  screenshots were added under `qa_tests/`.
