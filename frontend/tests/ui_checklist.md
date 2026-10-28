# FE_05 UI and QA checklist

Evidence combines this FE_05 run with retained FE_03/FE_04 browser checks.
`⚠` means limited or not fully verified; it is not a pass.

## Router and global shell

- [✅] Eight page routes render with one H1 each; 64 route × viewport × theme
  combinations at 360, 768, 1280, and 1920 CSS px had no horizontal overflow.
- [✅] Unknown hash falls back to Home; browser back/forward and route focus to
  `<main>` were checked.
- [✅] Navigation, page titles, mobile More dialog, Escape close, and skip link
  were exercised in Chromium.
- [⚠] A hard-reload-on-every-direct-URL matrix was not separately recorded.

## Theme and motion

- [✅] Dark/light toggle and persisted theme after reload were checked.
- [✅] Errors-page charts changed from the light palette to dark on theme
  toggle; chart count remained three.
- [✅] No-font fallback was tested by blocking Google Fonts; local/system
  fallback typography remained available.
- [⚠] Startup theme selection is implemented before paint, but a formal
  frame-by-frame no-flash test was not performed.
- [✅] Reduced-motion CSS and runtime branches are present; the reduced-motion
  media query was emulated.
- [⚠] Forced-colors media emulation was confirmed, but a full visual Windows
  high-contrast audit was not performed.

## Predict

- [✅] All 19 generated inputs (6 numeric, 13 categorical), presets, unknown
  categories, out-of-range warnings, and prediction updates were checked in
  retained browser tests.
- [✅] Slider accessible text includes units and correct singular/plural
  tutoring wording: “0 tutoring sessions”, “1 tutoring session”, and “2
  tutoring sessions”.
- [✅] Saved profile predictions A/B/C are 79.1, 66.3, and 51.9; the rerun
  Python/JavaScript parity test passed.
- [✅] What-if controls for the six numeric features and chart updates were
  checked in retained FE_03 browser tests.
- [✅] Share URL round-trip, scenario save/compare, and copied-link behavior
  were checked previously.
- [⚠] CSV Blob contents were inspected; the integrated browser did not expose
  a native download event.
- [⚠] Six distinct gauge-to-Python cases were not independently recorded in
  this FE_05 run; exported predictor parity passed on its seeded held-out
  sample, presets, and missing-category cases.
- [⚠] The permanent disclaimer's desktop first-viewport and mobile expanded
  result placement was not separately measured in the final browser run.

## Data pages and Viva

- [✅] Models table sorting, selected model, chart tabs, target status, and
  formatted test/CV/error values were checked after the precision changes.
- [✅] Explore tabs, Importance view toggle, and Errors residual/breakdown tabs,
  score filter, chart/table alternatives, and largest-error view were checked
  in retained browser tests.
- [⚠] Every control, pin action, sort direction, chart zoom action, and filter
  combination on all four data pages was not exhaustively re-run during FE_05.
- [✅] Viva flashcard reveal, quiz/reveal/self-rating, and persistence were
  exercised in retained checks. QA set Q1 progress to “got it” in this
  browser's local storage; no unrelated browser storage was cleared.
- [⚠] A complete keyboard-only tour of every control on all eight routes,
  exhaustive screen-reader testing, and user-triggered Viva reset were not
  completed.

## Accessibility, copy, and failure modes

- [✅] All page routes expose one H1, shared header/nav/main/footer landmarks,
  labelled form controls, and focus-visible styles.
- [✅] Predict sliders expose `aria-valuetext`; chart canvases expose image
  labels, and chart data-table buttons can reveal tabular alternatives.
- [✅] Manual contrast samples are documented in `FRONTEND_README.md`; no
  axe/Lighthouse automated score was collected.
- [⚠] Browser zoom at 200% and text-only enlargement remain unverified.
- [✅] A missing `importance.json` was intercepted and displayed the friendly
  page error with the JSON regeneration command.
- [✅] With local Chart.js blocked, the Errors page showed the warning and
  three accessible fallback tables; reloading with Chart.js restored charts.
- [N/A] Path B server-down behavior does not apply: this frontend is Path A and
  has no prediction service.
- [✅] Source-string scan of `index.html` and page modules found no forbidden
  causal/promise phrases, no false deployment/production/live-student claim,
  no `innerHTML`, `console.log`, or TODO markers. `CGPA` is only mentioned to
  clarify that it is not the target; Home and Method state that stress and
  screen time are not measured.
- [✅] The external links created in `method.js` use
  `rel="noopener noreferrer"`.
- [✅] Observed requests were local app files plus the optional
  `fonts.googleapis.com` stylesheet. No profile or prediction data was sent to
  an external service.

## Browser, performance, and build checks

- [✅] Chromium was used. Firefox was not tested.
- [✅] Local Home heading: 222 ms; initial readiness: 708 ms. Observed response
  bodies: 1,117,900 bytes over 29 responses; encoded resources: 1,111,337
  bytes; largest JSON `eda.json`: 419,849 bytes.
- [✅] Twenty simulated slider updates completed in 194 ms in the observed
  local run. These are one-run measurements, not performance guarantees.
- [✅] `python export_data.py`, `python tests/schema_check.py`, and
  `python tests/parity_test.py` passed. JSON total is 635,091 bytes; maximum
  parity difference was `4.26325641456e-14`.
- [✅] `node --check` passed for all 14 JavaScript modules.
- [⚠] VS Code's test extension did not provide runnable tests; verification
  used the project's Python scripts and browser checks instead. No formatter,
  ESLint, Stylelint, axe, or Lighthouse configuration was found/run.
- [⚠] ML project source files were not intentionally modified and
  `export_data.py` writes only `frontend/data/`; the earlier pre-Block-09
  hash list was not persisted, so an exact baseline hash comparison cannot be
  reproduced here.
- [⚠] No separate desktop or browser-version certificate is implied by the
  QA screenshots; screenshot capture viewport handling in the integrated
  browser was inconsistent.
