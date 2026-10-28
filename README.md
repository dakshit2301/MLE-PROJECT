# Exam Stress & Student Performance Predictor

An educational machine-learning project that analyzes the relationship between student-reported habits, academic factors, and a single examination score. The project includes a reproducible scikit-learn notebook, saved analysis outputs, a trained model, and an optional local web application called **Study Lab**.

> **Scope and interpretation:** The prediction target is `Exam_Score`, not stress, screen time, or CGPA. Stress and screen time do not appear in the dataset. Reported associations and model estimates are not evidence of causation, study advice, or guarantees about a real student's exam result.

## Table of Contents

- [Project Information](#project-information)
- [Project Features](#project-features)
- [Dataset and Data Quality](#dataset-and-data-quality)
- [Repository Structure](#repository-structure)
- [Run the Study Lab Frontend](#run-the-study-lab-frontend)
- [Run the Machine-Learning Notebook](#run-the-machine-learning-notebook)
- [Frontend Validation Tests](#frontend-validation-tests)
- [Saved Model Results](#saved-model-results)
- [Key Findings and Limitations](#key-findings-and-limitations)
- [Screenshots](#screenshots)
- [References and Acknowledgements](#references-and-acknowledgements)
- [License](#license)

## Project Information

- **Course:** ECSCI24302 — Machine Learning Essentials (Project-Based Learning)
- **Academic term:** Semester 5
- **Institution:** Adani University
- **Faculty Guide:** Diya Vadhwani
- **Team Members:**
  - Krushal Patel
  - Dakshit
  - Prince
Institution, faculty guide, and team details should be verified before academic submission.

## Project Features

- Exploratory data analysis (EDA) and saved visualizations.
- Data cleaning and missing-value handling within a training pipeline.
- Comparison of regression models using cross-validation.
- Hyperparameter tuning using training data.
- Evaluation on a held-out test set.
- Saved model, predictions, metrics, and error-analysis outputs.
- **Study Lab:** A local web frontend for exploring results and generating predictions using the saved model specification.
- Project reports and viva questions.

## Dataset and Data Quality

The project files identify the source as Kaggle's *Student Performance Factors* dataset. The candidate Kaggle URL and uploader attribution have not been independently confirmed. Verify the canonical dataset URL, uploader, dataset license, and access date before making a formal citation or redistributing the data.

The source CSV at the repository root and `data/raw_dataset.csv` were verified byte-identical.

### Cleaning and split summary

- **Raw dataset:** 6,607 rows and 20 columns (19 predictors and `Exam_Score`).
- **Removed row:** One row with an impossible score of 101 was removed using the stated 0–100 score-domain rule.
- **Cleaned dataset:** 6,606 rows.
- **Missing values:** Three columns contain 235 missing cells in total. These are imputed inside the training pipeline rather than during initial cleaning.
- **Duplicate rows:** No duplicate rows were found.
- **Saved split:** 5,284 training rows and 1,322 held-out test rows.
- **Model inputs:** Six numeric and thirteen categorical predictors are used by the final model.
- **Engineered features:** Six additional engineered columns are present in the split files for analysis, but the saved final model does not use those engineered columns.

## Repository Structure

```text
.
├── README.md
├── LICENSE
├── requirements.txt
├── Student Performance Factors.csv
├── data/
│   ├── raw_dataset.csv
│   ├── cleaned_dataset.csv
│   ├── train.csv
│   └── test.csv
├── notebook/
│   └── exam_stress_performance_correlator.ipynb
├── charts/
├── outputs/
│   ├── final_model.joblib
│   ├── final_comparison_table.csv
│   ├── test_predictions.csv
│   └── PROJECT_STATE.md
├── reports/
│   ├── final_report.md
│   ├── final_report.html
│   └── viva_questions.md
├── frontend/
│   ├── index.html
│   ├── export_data.py
│   ├── js/
│   ├── css/
│   ├── data/
│   └── tests/
└── qa_tests/
    ├── E2E_TEST_REPORT.md
    └── screenshots/
```

The repository snapshot includes Markdown and HTML reports but does not include a `final_report.pdf`.

The viva document and frontend export each contain 45 numbered questions (Q1–Q45) across nine groups. The viva document's introduction still claims 52 questions, so reconcile that count before submission.

## Run the Study Lab Frontend

Study Lab is a static local web application. It uses the saved LinearRegression model specification in the browser. It does not start a prediction API or retrain the model.

### Prerequisites

- Windows with PowerShell; the commands below are for Windows.
- Python 3.14 or another version compatible with the pinned dependencies in `requirements.txt`. The project reports validation with Python 3.14.6.
- A modern web browser such as Chrome or Edge.
- Node.js only if you want to run the frontend parity test.

### 1. First-Time Setup

Run these steps **only the first time** you set up the project on your laptop.

Open the extracted project folder in VS Code. Select **Terminal → New Terminal**. Ensure the terminal is in the project root, where `README.md` and `requirements.txt` are located.

#### Step 1: Create a virtual environment

```powershell
python -m venv .venv
```

#### Step 2: Install the required dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Wait for the installation to finish.

#### Step 3: Generate the frontend data files

```powershell
Set-Location frontend
..\.venv\Scripts\python.exe export_data.py
```

This generates or refreshes the JSON data exports used by the frontend.

#### Step 4: Start the local web server

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Keep the terminal open while using the application.

#### Step 5: Open the application

Open the following address in Chrome or Edge:

**[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

The Study Lab application should now be available on your laptop.

To stop the server, press `Ctrl+C` in the terminal.

### 2. Subsequent Runs (After Restarting Your Laptop)

After completing the first-time setup, you **do not** need to recreate the virtual environment, reinstall dependencies, or regenerate the frontend data every time.

#### Step 1: Open the project

Open your extracted `MLE-PROJECT-main` folder in VS Code.

#### Step 2: Open a new terminal

Select **Terminal → New Terminal**.

#### Step 3: Start the server

If your terminal is already in the project root, copy and paste:

```powershell
Set-Location frontend
python -m http.server 8000 --bind 127.0.0.1
```

If your terminal starts in a different directory, first navigate to the actual location of your project. For example, if the project is in your Downloads folder:

```powershell
Set-Location "$HOME\Downloads\MLE-PROJECT-main"
Set-Location frontend
python -m http.server 8000 --bind 127.0.0.1
```

Use the example path only if your project is actually located in `Downloads\MLE-PROJECT-main`.

#### Step 4: Open the application

Visit:

**[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

Keep the terminal open while using the app. Press `Ctrl+C` when you want to stop the server.

### 3. When Should You Run `export_data.py` Again?

For ordinary use, you do not need to run this script again after restarting your laptop.

Run it only when you intentionally change or regenerate the saved model or analysis outputs:

```powershell
python export_data.py
```

Run that command from the `frontend` directory. If you regenerate model outputs using the notebook, review the resulting JSON exports and application behaviour before relying on the updated frontend.

## Run the Machine-Learning Notebook

To reproduce the data analysis and model training:

1. Complete the first-time setup and install the dependencies.
2. Open `notebook/exam_stress_performance_correlator.ipynb` in VS Code with the Jupyter extension, or use a compatible Jupyter installation.
3. Select the Python interpreter/kernel from the project's `.venv` environment.
4. Set the notebook's working directory to `notebook/` before running the cells. The notebook uses relative paths such as `../data`, `../charts`, and `../outputs`.
5. Run the notebook cells in order.

JupyterLab itself is not pinned in `requirements.txt` and may need to be installed separately.

The notebook has 27 numbered sections and 120 code cells. It performs data checks and EDA, builds a training-only preprocessing pipeline, compares four regression estimators using five-fold cross-validation, tunes candidates using training data, evaluates the selected model on the held-out test split, and saves error-analysis and feature-importance outputs.

> **Note:** Running the notebook may regenerate or overwrite saved charts, metrics, model files, and other outputs. If you only want to use the existing Study Lab frontend, you do not need to rerun the notebook.

## Frontend Validation Tests

Run these commands from the `frontend` directory:

```powershell
python tests\schema_check.py
python tests\parity_test.py
```

The parity test also requires Node.js. If it is not installed, download it from [nodejs.org](https://nodejs.org/).

For frontend page descriptions, data flow, and additional QA details, see the [Frontend README](https://github.com/dakshit2301/MLE-PROJECT/blob/main/frontend/FRONTEND_README.md).

## Saved Model Results

The values below are reported in `outputs/final_comparison_table.csv`. The LinearRegression results are also recorded in the generated frontend metadata.

| Model                           | 5-fold CV R² (mean ± SD) |   Test MAE |   Test MSE |  Test RMSE |    Test R² |
| ------------------------------- | -----------------------: | ---------: | ---------: | ---------: | ---------: |
| DummyRegressor                  |         -0.0001 ± 0.0001 |     2.7629 |    13.2503 |     3.6401 |    -0.0020 |
| **LinearRegression (selected)** |      **0.7171 ± 0.0731** | **0.4103** | **2.3038** | **1.5178** | **0.8258** |
| GradientBoosting (tuned)        |          0.6977 ± 0.0705 |     0.5676 |     2.5062 |     1.5831 |     0.8105 |
| RandomForest (tuned)            |          0.6401 ± 0.0608 |     0.9752 |     3.4390 |     1.8544 |     0.7399 |

The project target is test R² ≥ 0.75. The selected model meets this target on the held-out test set (**0.8258**), while its mean cross-validation R² (**0.7171**) is below the target.

The higher test score is documented as a split-specific effect associated with the rare extreme-score tail. It is not evidence that the model generalizes better than cross-validation suggests.

On this held-out split:

- **Test MAE:** 0.4103 marks.
- **Test RMSE:** 1.5178 marks.
- **90th percentile absolute error:** 0.6424 marks.

These are aggregate evaluation summaries for this particular split, not per-student confidence intervals or guarantees. Verify all reported values against the committed output files before final submission.

## Key Findings and Limitations

- In the saved permutation-importance results, Attendance ranks first (mean decrease in R²: 0.8019), followed by Hours_Studied (0.4916). These are predictive-importance values for this dataset, not causal effects.
- The ten largest held-out squared errors account for 93.39% of the total squared error, showing that average metrics do not describe every score range equally well.
- The dataset does not contain stress, screen-time, or CGPA fields. The model cannot measure or predict those outcomes.
- The target represents a single exam-score snapshot.
- Dataset provenance and possible synthetic-data characteristics require confirmation.
- The analysis describes associations and model limitations; it does not establish real-world causes or intervention effects.
- The reported test score is specific to the held-out split and should be interpreted alongside cross-validation results.
- The viva document's question-count discrepancy (45 actual questions versus 52 stated in the introduction) should be resolved before submission.

## Screenshots

Add screenshots captured from your own running Study Lab application to help visitors understand the interface.

For example, create a `docs/screenshots/` directory and save your screenshots there:

- `study-lab-dashboard.png`
- `study-lab-prediction.png`
- `study-lab-models.png`

Once the image files have been added to the repository, include them using relative paths:

```markdown
![Study Lab dashboard](docs/screenshots/study-lab-dashboard.png)
![Study Lab prediction page](docs/screenshots/study-lab-prediction.png)
![Study Lab model comparison](docs/screenshots/study-lab-models.png)
```

Do not add these image references until the corresponding files exist; broken image links should be avoided.

## References and Acknowledgements

The project files identify the dataset as *Student Performance Factors* from Kaggle. Confirm the canonical dataset URL, uploader, license, and access date before adding a formal dataset citation.

The analysis uses Python and common data-science libraries, including pandas, NumPy, scikit-learn, SciPy, Matplotlib, and Seaborn.

Follow your course's disclosure rules when documenting AI-assisted work. Verify the submitted report, references, results, and project details yourself.

## License

The repository includes an MIT `LICENSE` for the project code. This does **not** automatically establish a license for the dataset. Check the dataset's own license and terms before redistributing it.
