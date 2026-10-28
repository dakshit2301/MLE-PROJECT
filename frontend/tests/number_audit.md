# FE_04 number audit

Values shown by the FE_04 pages were checked against their exported JSON sources. Rounded display values are marked as matches when they round from the source value at the precision shown in the UI. Derived totals are recalculated from the cited JSON fields.

| Page | Displayed number | Source JSON path | Match |
|---|---:|---|:---:|
| Explore | 6,607 raw rows | `meta.json:n_rows_raw` | ✓ |
| Explore | 6,606 cleaned rows | `meta.json:n_rows_clean` | ✓ |
| Explore | 20 columns | `meta.json:n_columns` | ✓ |
| Explore | 0 duplicate rows | `eda.json:data_quality.n_duplicates` | ✓ |
| Explore | 235 missing cells | `sum(eda.json:data_quality.missing_by_column[*])` | ✓ |
| Explore | 1 row removed | `eda.json:data_quality.rows_removed` | ✓ |
| Explore | 67.23 target mean | `meta.json:target_stats.mean` (2 decimals) | ✓ |
| Explore | 55 minimum score | `meta.json:target_stats.min` | ✓ |
| Explore | 100 maximum score | `meta.json:target_stats.max` | ✓ |
| Explore | 0.582 Pearson r for Attendance | `eda.json:scatter.Attendance.pearson` (3 decimals) | ✓ |
| Importance | 0.8019 Attendance permutation decrease | `importance.json:permutation[0].mean_decrease_r2` | ✓ |
| Importance | 0.0245 Attendance permutation standard deviation | `importance.json:permutation[0].std` | ✓ |
| Importance | 0.4916 Hours_Studied permutation decrease | `importance.json:permutation[1].mean_decrease_r2` | ✓ |
| Importance | 0.0131 Hours_Studied permutation standard deviation | `importance.json:permutation[1].std` | ✓ |
| Importance | 0.0751 Access_to_Resources permutation decrease | `importance.json:permutation[2].mean_decrease_r2` | ✓ |
| Importance | 0.0733 Previous_Scores permutation decrease | `importance.json:permutation[3].mean_decrease_r2` | ✓ |
| Importance | 0.0732 Parental_Involvement permutation decrease | `importance.json:permutation[4].mean_decrease_r2` | ✓ |
| Importance | 2.2846 Attendance coefficient | `importance.json:coefficients[0].coefficient` (4 decimals) | ✓ |
| Importance | 1.7430 Hours_Studied coefficient | `importance.json:coefficients[1].coefficient` (4 decimals) | ✓ |
| Importance | 1.0463 Access_to_Resources coefficient | `importance.json:coefficients[2].coefficient` (4 decimals) | ✓ |
| Errors | -0.0961 mean residual bias | `errors.json:summary.mean_residual_bias` | ✓ |
| Errors | 1.5148 residual standard deviation | `errors.json:summary.std_residual` | ✓ |
| Errors | 0.41 MAE | `errors.json:summary.test_mae` (2 decimals) | ✓ |
| Errors | 1.52 RMSE | `errors.json:summary.test_rmse` (2 decimals) | ✓ |
| Errors | 0.6424 90th percentile absolute error | `errors.json:summary.p90_absolute_error` | ✓ |
| Errors | 29.042 maximum absolute error | `errors.json:summary.max_absolute_error` (3 decimals) | ✓ |
| Errors | 93.39% squared error from the top ten misses | `errors.json:summary.top10_squared_error_share_pct` | ✓ |
| Errors | 1,322 held-out records | `length(test_points.json:actual)` | ✓ |
| Errors | 15 largest-error records | `length(errors.json:largest_errors)` | ✓ |
| Errors | 5 records in the 80+ actual-score band | `errors.json:by_actual_range[range="80+"].n` | ✓ |
| Method | 6,607 raw rows | `meta.json:n_rows_raw` | ✓ |
| Method | 6,606 cleaned rows | `meta.json:n_rows_clean` | ✓ |
| Method | 5,284 training rows | `meta.json:n_rows_train` | ✓ |
| Method | 1,322 held-out test rows | `meta.json:n_rows_test` | ✓ |
| Method | 20 columns | `meta.json:n_columns` | ✓ |
| Method | 235 missing cells | `sum(eda.json:data_quality.missing_by_column[*])` | ✓ |
| Method | 0 duplicate rows | `eda.json:data_quality.n_duplicates` | ✓ |
| Method | 1 row removed | `eda.json:data_quality.rows_removed` | ✓ |
| Method | 4 candidate model rows | `length(models.json:final_table)` | ✓ |
| Method | 0.826 test R² | `meta.json:final_model.test_r2` (3 decimals) | ✓ |
| Method | 0.717 cross-validation R² | `meta.json:final_model.cv_r2` (3 decimals) | ✓ |
| Method | 0.75 target R² | `meta.json:target_r2` | ✓ |
| Viva | 45 saved questions | `length(viva.json)` | ✓ |
| Viva | 9 topic groups | `count_unique(viva.json[*].group)` | ✓ |
| Viva | 6,607 dataset records (Q1) | `viva.json[question="Q1"].answer` | ✓ |
| Viva | 19 attributes (Q1) | `viva.json[question="Q1"].answer` | ✓ |
| Viva | 6 continuous numeric features (Q4) | `viva.json[question="Q4"].answer` | ✓ |
| Viva | 13 categorical features (Q4) | `viva.json[question="Q4"].answer` | ✓ |
| Viva | 67.23 mean Exam_Score (Q5) | `meta.json:target_stats.mean` (2 decimals; used in the corrected Q5 display) | ✓ |
| Viva | 3.87 standard deviation (Q5) | `meta.json:target_stats.std` (2 decimals; used in the corrected Q5 display) | ✓ |
| Viva | 55 minimum Exam_Score (Q5) | `meta.json:target_stats.min` (used in the corrected Q5 display) | ✓ |
| Viva | 100 maximum Exam_Score (Q5) | `meta.json:target_stats.max` (used in the corrected Q5 display) | ✓ |

The saved Viva answer for Q5 originally rounded the target mean and standard deviation differently from `meta.json` (67.24 and 3.88). The displayed answer now reads those two values and the observed score range from `meta.json`.

## FE_05 — Home, Predict, and Models

The following checks extend the source audit to the remaining values shown by the FE_05 pages. Values are the UI display precision; source files retain their full exported precision.

| Page | Displayed number | Source JSON path / derivation | Match |
|---|---:|---|:---:|
| Home | 6,606 cleaned records | `meta.json:n_rows_clean` | ✓ |
| Home | 5,284 train / 1,322 held-out test | `meta.json:n_rows_train`, `meta.json:n_rows_test` | ✓ |
| Home | 0.826 test R² | `meta.json:final_model.test_r2` (3 decimals) | ✓ |
| Home | 0.717 CV R² | `meta.json:final_model.cv_r2` (3 decimals) | ✓ |
| Home | 0.75 target R² | `meta.json:target_r2` (2 decimals) | ✓ |
| Home | 0.41 marks typical error | `meta.json:final_model.test_mae` (2 decimals) | ✓ |
| Predict | 79.1 preset A prediction | `model_spec.json:presets[0].inputs` → Path A predictor (1 decimal) | ✓ |
| Predict | 66.3 preset B prediction | `model_spec.json:presets[1].inputs` → Path A predictor (1 decimal) | ✓ |
| Predict | 51.9 preset C prediction | `model_spec.json:presets[2].inputs` → Path A predictor (1 decimal) | ✓ |
| Predict | 0.64 marks typical 90th-percentile error | `model_spec.json:uncertainty.p90_abs_error` (2 decimals) | ✓ |
| Predict | 19 model inputs: 6 numeric, 13 categorical | `length(model_spec.json:features_used)` and feature `kind` values | ✓ |
| Models | 4 candidate model rows | `models.json:final_table` | ✓ |
| Models | LinearRegression CV R² 0.717 ± 0.073 | `models.json:final_table[Model="LinearRegression"].CV_R2_mean`, `.CV_R2_std` (3 decimals) | ✓ |
| Models | LinearRegression test MAE 0.41 marks | `models.json:final_table[Model="LinearRegression"].Test_MAE` (2 decimals) | ✓ |
| Models | LinearRegression test MSE 2.3038 | `models.json:final_table[Model="LinearRegression"].Test_MSE` (4 decimals) | ✓ |
| Models | LinearRegression test RMSE 1.52 marks | `models.json:final_table[Model="LinearRegression"].Test_RMSE` (2 decimals) | ✓ |
| Models | LinearRegression test R² 0.826 | `models.json:final_table[Model="LinearRegression"].Test_R2` (3 decimals) | ✓ |
| Models | 0.75 target R² | `meta.json:target_r2` (2 decimals) | ✓ |

The preset prediction values are computed by the saved-model JavaScript predictor from each exported `model_spec.json` profile; the Python/JavaScript parity test independently checks that implementation against the saved model.
