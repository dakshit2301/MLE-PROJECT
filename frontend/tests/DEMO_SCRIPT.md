# Study Lab — Five-minute faculty demo

## Opening (20 seconds)

“This is an optional local frontend for the finished ML project. It reads the
saved results and reproduces the already-fitted LinearRegression model in the
browser. The target is `Exam_Score`; stress and screen time were not measured.
These estimates are demonstrations, not real student results or study advice.”

## Six stops

1. **Home — headline metrics (45 seconds).** Point to 6,606 cleaned rows,
   LinearRegression, test R² `0.826`, CV R² `0.717`, target `0.75`, and typical
   held-out MAE `0.41` marks. Explain that the target was met on the held-out
   test split, not on cross-validation.
2. **Predict — presets (55 seconds).** Choose the three saved profiles in turn:
   A `79.1`, B `66.3`, C `51.9`. Show that these are model estimates from
   example profiles, not observed students. Point out the MAE/RMSE uncertainty
   bands and warning when an input leaves the training range.
3. **Predict — Attendance what-if (45 seconds).** Select Attendance in the
   what-if control and vary it while holding the other profile values fixed.
   Say: “This is the fitted model's response to changing one input; it does not
   prove that changing attendance changes a real exam score.”
4. **Models — target status (45 seconds).** Compare candidates and show
   LinearRegression at CV R² `0.717 ± 0.073`, test R² `0.826`, MAE `0.41`, and
   RMSE `1.52`. The threshold is `0.75`: test met; CV not met.
5. **Errors — largest misses (55 seconds).** State that these are held-out
   test-set errors, not live records. Show the largest-error table and that the
   ten largest misses account for `93.39%` of total squared error. Avoid
   identifying individual people; the rows are evaluation records.
6. **Method — leakage safeguards (55 seconds).** Show the timeline and explain
   that preprocessing and model selection were fitted using training data and
   cross-validation, with a separate held-out test split of 1,322 rows. Explain
   that the test R² being higher than CV R² is documented as a random-split
   artifact associated with the rare extreme-score tail, not proof of better
   generalization.

## Likely examiner questions

1. **Where does each number come from?** The pages read generated JSON exports
   from the saved project artifacts. `tests/number_audit.md` maps key displayed
   values back to those JSON fields.
2. **Does the model run in the browser?** Yes. Path A uses the exported fitted
   scaler, category order, coefficients, and intercept in `predictor.js`; no
   prediction server or API is involved.
3. **Is this deployed?** No. It runs locally using Python's static HTTP server.
4. **Does it prove that studying more raises marks?** No. The app shows
   associations and the fitted model's response, not causal effects.
5. **Why is test R² higher than CV R²?** The saved project documents a random
   split difference in the rare extreme-score tail. The test result is not
   evidence of improved generalization.
6. **Why show uncertainty?** The held-out MAE (`0.4103` marks) and RMSE
   (`1.5178` marks) summarize different aspects of test error; they are not
   guarantees for a particular profile.
7. **Does the app collect or upload profiles?** No. Inputs and predictions are
   processed in the browser. The optional Google Fonts stylesheet is the only
   observed external origin; no profile or project data is sent to it.
8. **What are the main limitations?** The model only targets `Exam_Score`,
   omits unmeasured stress/screen time, and its dataset URL, author, license,
   and access date still need student verification.

## Before the demo

- From the project root, run `Set-Location frontend`, `python export_data.py`,
  then `python -m http.server 8000`; open <http://localhost:8000>.
- Check that the browser page says the target is `Exam_Score`, and do not
  describe a profile as a real student.
- If the room has no internet, the system font fallbacks remain available.
- Firefox, 200% zoom, and a complete assistive-technology audit have not been
  verified.
