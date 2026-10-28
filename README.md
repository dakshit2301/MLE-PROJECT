# Exam Stress & Student Performance Predictor

An educational machine-learning project that analyzes the relationship between student-reported habits and academic factors and a single examination score. The project includes a reproducible scikit-learn notebook, saved analysis outputs, and an optional local frontend that reproduces the saved model in the browser.

> **Scope and interpretation:** The prediction target is `Exam_Score`, not stress, screen time, or CGPA. Stress and screen time do not appear in the dataset. Reported associations and model estimates are not evidence of causation, study advice, or a real student's exam result.

## Project information

- **Course:** ECSCI24302 — Machine Learning Essentials (Project-Based Learning)
- **Academic term:** Semester 5
- **Institution, faculty guide, and team details:** Add the confirmed information before academic submission; it is not included here because it was not available for verification.
- **Code license:** The repository includes an MIT `LICENSE` for the project code. This does not establish a license for the dataset.

## Dataset and data quality

The project files identify the source as the Kaggle *Student Performance Factors* dataset. The candidate Kaggle URL and uploader attribution in the project have not been independently confirmed. Verify the canonical URL, uploader, dataset license, and access date before making a formal citation or redistributing the data. A copy of the source CSV is included at the repository root and in `data/raw_dataset.csv`; these two files were verified byte-identical.

The raw dataset contains **6,607 rows and 20 columns** (19 predictors and `Exam_Score`). One row with an impossible score of 101 was removed using the 0–100 score domain rule, leaving **6,606 cleaned rows**. The three columns with missing values retain a total of 235 missing cells; they are imputed inside the training pipeline rather than during initial cleaning. No duplicate rows were found.

The saved split contains **5,284 training rows** and **1,322 held-out test rows**. Six numeric and thirteen categorical predictors are used by the final model. Six engineered columns are also present in the split files for analysis, but the saved final model does not use those engineered columns.

## Repository layout

```text
.
├── README.md
├── LICENSE
├── requirements.txt
├── Student Performance Factors.csv    # byte-identical copy of data/raw_dataset.csv
├── data/
│   ├── raw_dataset.csv
│   ├── cleaned_dataset.csv
│   ├── train.csv
│   └── test.csv
├── notebook/
│   └── exam_stress_performance_correlator.ipynb
├── charts/                            # Saved EDA, model, and error-analysis charts
├── outputs/                           # Validation, metrics, predictions, and final model
│   ├── final_model.joblib
│   ├── final_comparison_table.csv
│   ├── test_predictions.csv
│   └── PROJECT_STATE.md
├── reports/
│   ├── final_report.md
│   ├── final_report.html
│   └── viva_questions.md
├── frontend/                          # Optional local Study Lab application
│   ├── index.html
│   ├── export_data.py
│   ├── js/
│   ├── css/
│   ├── data/                          # Generated JSON exports
│   └── tests/
└── qa_tests/
    ├── E2E_TEST_REPORT.md
    └── screenshots/
```

The current repository snapshot contains Markdown and HTML reports; it does not contain a `final_report.pdf`. The source viva document and frontend export each contain **45 numbered questions (Q1–Q45)** across nine groups. The viva document's introduction still claims 52 questions, so reconcile that count before submission.

## Run the frontend

The Study Lab frontend is a static local web app. It uses the saved LinearRegression model specification in the browser; it does not start a prediction API or retrain the model.

Use Python **3.14+** with the pinned dependencies in `requirements.txt` (validated with Python 3.14.6). In PowerShell, from the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Set-Location frontend
python export_data.py
python -m http.server 8000
```

Open <http://localhost:8000> and keep the terminal open while using the app. Press `Ctrl+C` to stop the server. After initial setup, if the saved model and outputs have not changed, start it next time with:

```powershell
Set-Location frontend
python -m http.server 8000
```

Run `python export_data.py` again only after intentionally changing or regenerating the saved ML outputs/model. For frontend validation, from the `frontend` directory run:

```powershell
python tests\schema_check.py
python tests\parity_test.py
```

The parity test also requires Node.js. See [frontend/FRONTEND_README.md](frontend/FRONTEND_README.md) for the page tour, data flow, and QA details.

## Run the machine-learning notebook

Install `requirements.txt`, open `notebook/exam_stress_performance_correlator.ipynb` in VS Code with the Jupyter extension or in a Jupyter installation, and select the project `.venv` interpreter/kernel. Set the notebook kernel's working directory to `notebook/` before running all cells; the notebook uses relative paths such as `../data`, `../charts`, and `../outputs`. JupyterLab itself is not pinned in `requirements.txt` and may need to be installed separately.

The notebook has 27 numbered sections and 120 code cells. It performs data checks and EDA, creates and evaluates a training-only preprocessing pipeline, compares four regression estimators with five-fold cross-validation, tunes candidates using training data, evaluates the selected model on the held-out test split, and saves error-analysis and feature-importance outputs.

## Saved model results

Values below are from `outputs/final_comparison_table.csv`; the LinearRegression values are also recorded in the generated frontend metadata.

| Model | 5-fold CV R² (mean ± SD) | Test MAE | Test MSE | Test RMSE | Test R² |
|---|---:|---:|---:|---:|---:|
| DummyRegressor | -0.0001 ± 0.0001 | 2.7629 | 13.2503 | 3.6401 | -0.0020 |
| **LinearRegression (selected)** | **0.7171 ± 0.0731** | **0.4103** | **2.3038** | **1.5178** | **0.8258** |
| GradientBoosting (tuned) | 0.6977 ± 0.0705 | 0.5676 | 2.5062 | 1.5831 | 0.8105 |
| RandomForest (tuned) | 0.6401 ± 0.0608 | 0.9752 | 3.4390 | 1.8544 | 0.7399 |

The project target is test R² ≥ 0.75. The selected model meets that target on the held-out test set (**0.8258**) but its mean cross-validation R² (**0.7171**) is below the target. The test score being higher than CV is documented as a split-specific effect associated with the rare extreme-score tail; it is not evidence that the model generalizes better than CV suggests.

Test MAE is **0.4103 marks**, RMSE is **1.5178 marks**, and the 90th percentile absolute error is **0.6424 marks** on this held-out split. These are aggregate evaluation summaries, not per-student confidence intervals or guarantees.

## Findings and limitations

- In the saved permutation-importance results, Attendance ranks first (mean decrease in R²: 0.8019), followed by Hours_Studied (0.4916). These are predictive importance values for this dataset, not causal effects.
- The ten largest held-out squared errors account for 93.39% of the total squared error, showing that average metrics do not describe every score range equally well.
- The dataset has no stress, screen-time, or CGPA fields; the model cannot measure or predict those outcomes.
- The target is one exam-score snapshot, and the dataset's source provenance and possible synthetic-data characteristics need confirmation.
- The report describes associations and model limitations; it does not establish real-world causes or intervention effects.
- The Viva question-count discrepancy noted above remains unresolved.

## References and acknowledgements

The dataset is identified in project files as *Student Performance Factors* from Kaggle; confirm its canonical source, uploader, and license before final citation. Python, pandas, NumPy, scikit-learn, SciPy, Matplotlib, and Seaborn are used in the analysis. Follow your course's disclosure rules when documenting AI-assisted work and verify the submitted report and project details yourself.
