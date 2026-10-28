# Exam Stress & Student Performance Predictor

An end-to-end, leak-free machine learning project analyzing how student study habits, attendance, social-environmental factors, and academic background associate with final examination scores. Built as an empirical, reproducible pipeline, the project benchmarks four regression models (Dummy Baseline, Linear Regression, Random Forest, and Gradient Boosting) using rigorous 5-fold cross-validation and a locked test-set evaluation. *Note on dataset variables:* Because the underlying dataset did not contain direct psychometric measurements for stress or screen time, motivation level and peer influence were evaluated as domain-appropriate proxies, as documented throughout the project.

---

## Course & Team Information

- **Course:** ECSCI24302 – Machine Learning Essentials (Project-Based Learning)
- **Institution:** [University / College Name — TO BE FILLED]
- **Academic Term:** Semester 5
- **Faculty Guide / Mentor:** [Guide / Professor Name — TO BE FILLED]
- **Team Members:**
  - `[Name 1 — Roll / Enrolment No. — Contribution: to be filled]`
  - `[Name 2 — Roll / Enrolment No. — Contribution: to be filled]`
  - `[Name 3 — Roll / Enrolment No. — Contribution: to be filled]`
  - `[Name 4 — Roll / Enrolment No. — Contribution: to be filled]`

---

## Dataset Description

- **Dataset Name:** Student Performance Factors
- **Platform / Source:** Kaggle (`Student Performance Factors.csv`)
- **Expected URL:** `https://www.kaggle.com/datasets/lainguyn123/student-performance-factors` *(TO BE CONFIRMED BY STUDENT)*
- **Author:** `lainguyn123` *(TO BE CONFIRMED BY STUDENT)*
- **License:** CC BY 4.0 / Public Domain *(TO BE CONFIRMED BY STUDENT)*
- **Date Accessed:** `2026-10-25`
- **Dimensions:** 6,607 original rows, 20 columns (19 features + 1 continuous target: `Exam_Score`). One domain-invalid row (`Exam_Score > 100`) was removed in Block 2, leaving 6,606 validated records.

---

## Project Structure

```text
exam-stress-performance-correlator/
├── data/
│   ├── raw_dataset.csv                 # Pristine copy of raw Kaggle dataset (6607 rows)
│   ├── cleaned_dataset.csv             # Cleaned dataset (6606 rows, NaN preserved for pipeline imputation)
│   ├── train.csv                       # 80% split (5284 rows, includes engineered features)
│   └── test.csv                        # 20% split (1322 rows, locked until final evaluation)
├── notebook/
│   └── exam_stress_performance_correlator.ipynb  # Comprehensive 27-section executable notebook
├── charts/                             # Publication-quality charts (150 DPI)
│   ├── target_distribution.png         # Chart 1: Target distribution & normality
│   ├── correlation_heatmap.png         # Chart 2: Feature correlation matrix
│   ├── study_vs_performance.png        # Chart 3: Study hours vs Exam Score
│   ├── sleep_vs_performance.png        # Chart 4: Sleep hours vs Exam Score
│   ├── motivation_vs_performance.png   # Chart 5: Motivation level vs Exam Score
│   ├── attendance_vs_performance.png   # Chart 6: Attendance vs Exam Score
│   ├── actual_vs_predicted.png         # Chart 7: Final model actual vs predicted
│   ├── residual_plot.png               # Chart 8: Residual vs predicted & distribution
│   ├── feature_importance.png          # Chart 9: Permutation & coefficient importances
│   ├── outlier_boxplots.png            # Numeric feature boxplots
│   ├── numeric_feature_distributions.png# Univariate histograms
│   └── cv_r2_comparison.png           # Cross-validation R² comparison
├── outputs/
│   ├── dataset_validation.json         # Raw dataset structural audit
│   ├── data_quality_summary.json       # Missing values & outlier counts
│   ├── correlation_table.csv           # Pearson & Spearman correlation metrics
│   ├── feature_config.json             # Selected feature set specifications
│   ├── cv_results.csv                  # Default & tuned cross-validation results
│   ├── tuning_results.json             # GridSearchCV parameters & scores
│   ├── test_predictions.csv            # Test set predictions across all models
│   ├── final_model.joblib              # Serialized final scikit-learn Pipeline
│   ├── final_comparison_table.csv      # Master comparison table
│   ├── error_analysis_summary.json     # Subgroup & range error metrics
│   ├── feature_importance.csv          # Ranked permutation importance table
│   └── PROJECT_STATE.md                # Persistent multi-block state document
├── reports/
│   ├── final_report.md                 # 18-section comprehensive academic project report
│   └── viva_questions.md              # 50 detailed viva examination preparation questions
├── requirements.txt                    # Pinned library dependencies
└── README.md                           # Project overview & reproduction guide
```

---

## How to Reproduce & Run

1. **Python Environment:** Requires Python 3.10+ (tested on Python 3.14).
2. **Clone / Open Workspace:** Open the `exam-stress-performance-correlator/` root directory in your editor or terminal.
3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Execute Notebook:**
   - Launch Jupyter Lab or Notebook:
     ```bash
     jupyter lab
     ```
   - Open `notebook/exam_stress_performance_correlator.ipynb`.
   - **Important:** The notebook uses relative paths (`../data`, `../charts`, `../outputs`) and must be run with the kernel's working directory set to `notebook/`.
   - Select **Kernel → Restart & Run All**. The entire notebook executes top-to-bottom without manual intervention.

---

## Workflow Summary

The project proceeds systematically across 27 ordered notebook sections:
1. **Sections 1–5:** Setup, objective definition, dataset integrity checks, and data dictionary mapping.
2. **Sections 6–7:** Deep data quality auditing (missing values, types, outliers) and domain-grounded cleaning.
3. **Sections 8–9:** Exploratory data analysis, univariate/bivariate visualizations, and Pearson/Spearman correlation.
4. **Sections 10–13:** Feature engineering exploration, leak-free 80/20 splitting, feature selection, and preprocessor pipeline assembly.
5. **Sections 14–18:** Baseline and model training (Dummy, Linear Regression, Random Forest, Gradient Boosting) under 5-fold CV.
6. **Sections 19–21:** Hyperparameter tuning via GridSearchCV on training CV, pre-committed model selection, locked test evaluation, and master comparison.
7. **Sections 22–24:** Residual error analysis, permutation feature importances, and interactive student prediction demonstrations.
8. **Sections 25–27:** Final findings synthesis, limitations discussion, and actionable future directions.

---

## Final Results & Target Status

**Master Comparison Table (`outputs/final_comparison_table.csv`):**

| Model | 5-Fold CV $R^2$ (mean $\pm$ std) | Test MAE (marks) | Test MSE | Test RMSE (marks) | Test $R^2$ |
|---|---|---|---|---|---|
| DummyRegressor (Mean Baseline) | $-0.0001 \pm 0.0001$ | 2.7629 | 13.2503 | 3.6401 | $-0.0020$ |
| **LinearRegression** | $\mathbf{0.7171 \pm 0.0731}$ | $\mathbf{0.4103}$ | $\mathbf{2.3038}$ | $\mathbf{1.5178}$ | $\mathbf{0.8258}$ |
| GradientBoostingRegressor (tuned) | $0.6977 \pm 0.0705$ | 0.5676 | 2.5062 | 1.5831 | 0.8105 |
| RandomForestRegressor (tuned) | $0.6401 \pm 0.0608$ | 0.9752 | 3.4390 | 1.8544 | 0.7399 |

- **Performance Target:** Required test $R^2 \ge 0.75$.
- **Result:** **Final model test $R^2 = 0.8258$ ; target = $0.75$ ; target met: YES**
- **Typical Prediction Error:** Test MAE is **$0.41$ marks** (on average, predictions deviate by ~0.4 marks on a 100-point scale).
- **Generalization Gap Explanation:** Test $R^2$ (0.8258) is higher than CV $R^2$ (0.7171) because high-scoring students ($\ge 80$ marks), who represent the main source of residual variance, constituted $0.79\%$ of the training set but only $0.38\%$ of the random test split. With fewer extreme outliers, the test $R^2$ naturally evaluates higher.

---

## Key Findings

1. **Attendance is the Dominant Predictor:** Attendance showed the highest correlation ($r = 0.58$), the largest standardized regression coefficient ($\beta = +2.285$), and highest permutation importance ($\Delta R^2 = 0.8019$). A 1 SD increase (~14% attendance) is associated with ~2.3 marks higher predicted score.
2. **Study Time is the Second Strongest Factor:** Study hours showed strong positive association ($r = 0.45$, $\beta = +1.743$, $\Delta R^2 = 0.4916$). Each additional standard deviation of study time (~5.6 hrs/wk) is associated with ~1.7 marks higher score.
3. **Sleep Hours Showed Near-Zero Predictive Value:** Variations in sleep duration exhibited no statistical association with exam performance ($r = -0.02$, $\beta = -0.012$, $\Delta R^2 = 0.0000$).
4. **Linear Regression Outperformed Complex Non-Linear Ensembles:** Plain Linear Regression matched the dataset's underlying additive linear structure better than Random Forest or Gradient Boosting, while avoiding tree-based overfitting and offering complete interpretability.
5. **Errors are Concentrated in an Unexplained High-Score Tail:** Across 98.7% of students (scores 55–79 marks), prediction errors are tiny (MAE ~0.3 marks). However, 10 extreme high-score outliers ($\ge 84$ marks) account for **93.39%** of the entire sum of squared errors.

---

## Limitations

1. **Synthetic / Simulated Data Signature:** Characteristics such as a narrow target spread (std ~3.9), near-perfect linearity, and lack of noise suggest the dataset was synthetically generated.
2. **Omission of Stress and Screen Time:** Direct psychometric measurements for stress and screen telemetry were missing; proxy variables (motivation, peer influence) were studied instead.
3. **Single Exam Snapshot:** The target is an isolated exam mark rather than longitudinal cumulative GPA or sustained conceptual learning.
4. **Coarse Input Scales:** Key inputs (study hours, sleep hours) are rounded integers, and categorical attributes are measured on coarse 3-point ordinal scales.
5. **Non-Causal Associative Evidence:** Statistical coefficients show associations within historical survey responses, not proven causal mechanisms.

---

## Academic Integrity & Acknowledgements

- **Dataset Citation:** *Student Performance Factors*, Kaggle dataset by `lainguyn123`.
- **Core Software:** Python, scikit-learn (Pedregosa et al., 2011), pandas, NumPy, Matplotlib, Seaborn, and SciPy.
- **AI Coding Assistance Statement:** An agentic AI coding assistant was utilized as a pair-programming tool for structuring code and verifying pipeline integrity; all project methodology, statistical logic, interpretations, and results have been thoroughly reviewed, understood, and defended by the student team.
