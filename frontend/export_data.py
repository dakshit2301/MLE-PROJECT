"""Export read-only project outputs into the frontend's generated JSON data."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from scipy.stats import linregress, pearsonr, spearmanr


FRONTEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = FRONTEND_DIR.parent
DATA_DIR = FRONTEND_DIR / "data"
OUTPUT_DIR = PROJECT_DIR / "outputs"
SOURCE_DATA_DIR = PROJECT_DIR / "data"
REPORTS_DIR = PROJECT_DIR / "reports"
TARGET = "Exam_Score"
TARGET_R2 = 0.75

REQUIRED_FILES = [
    SOURCE_DATA_DIR / "cleaned_dataset.csv",
    SOURCE_DATA_DIR / "train.csv",
    SOURCE_DATA_DIR / "test.csv",
    SOURCE_DATA_DIR / "raw_dataset.csv",
    OUTPUT_DIR / "PROJECT_STATE.md",
    OUTPUT_DIR / "dataset_validation.json",
    OUTPUT_DIR / "data_quality_summary.json",
    OUTPUT_DIR / "correlation_table.csv",
    OUTPUT_DIR / "feature_config.json",
    OUTPUT_DIR / "cv_results.csv",
    OUTPUT_DIR / "tuning_results.json",
    OUTPUT_DIR / "final_comparison_table.csv",
    OUTPUT_DIR / "final_model.joblib",
    OUTPUT_DIR / "test_predictions.csv",
    OUTPUT_DIR / "error_analysis_summary.json",
    OUTPUT_DIR / "feature_importance.csv",
    REPORTS_DIR / "viva_questions.md",
]

NUMERIC_LABELS = {
    "Hours_Studied": "Hours studied per week",
    "Attendance": "Attendance percentage",
    "Sleep_Hours": "Sleep hours per night",
    "Previous_Scores": "Previous exam score",
    "Tutoring_Sessions": "Tutoring sessions",
    "Physical_Activity": "Physical activity days per week",
}

CATEGORICAL_LABELS = {
    "Parental_Involvement": "Parental involvement",
    "Access_to_Resources": "Access to resources",
    "Motivation_Level": "Motivation level",
    "Family_Income": "Family income",
    "Teacher_Quality": "Teacher quality",
    "Peer_Influence": "Peer influence",
    "Parental_Education_Level": "Parental education level",
    "Distance_from_Home": "Distance from home",
    "Extracurricular_Activities": "Extracurricular activities",
    "Internet_Access": "Internet access",
    "School_Type": "School type",
    "Learning_Disabilities": "Learning disabilities",
    "Gender": "Gender",
}

ENGINEERED_FORMULAS = [
    {
        "name": "Study_x_Attendance",
        "formula_text": "Hours_Studied * Attendance / 100",
        "used_by_model": False,
    },
    {
        "name": "Sleep_Deficit",
        "formula_text": "max(0, 7 - Sleep_Hours)",
        "used_by_model": False,
    },
    {
        "name": "Sleep_Category",
        "formula_text": "0 if Sleep_Hours < 6; 1 if Sleep_Hours <= 8; otherwise 2",
        "used_by_model": False,
    },
    {
        "name": "Has_Tutoring",
        "formula_text": "1 if Tutoring_Sessions > 0; otherwise 0",
        "used_by_model": False,
    },
    {
        "name": "Study_per_Sleep",
        "formula_text": "Hours_Studied / Sleep_Hours (0 if Sleep_Hours is 0)",
        "used_by_model": False,
    },
    {
        "name": "Active_Total",
        "formula_text": "Physical_Activity + 1 if Extracurricular_Activities == 'Yes'",
        "used_by_model": False,
    },
]


def require_inputs() -> None:
    missing = [str(path) for path in REQUIRED_FILES if not path.is_file()]
    if missing:
        raise FileNotFoundError(
            "Missing required ML project input(s):\n- " + "\n- ".join(missing)
        )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def finite_number(value: Any) -> float | int | None:
    if value is None or pd.isna(value):
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return number


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return finite_number(value)
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def write_json(name: str, payload: Any) -> None:
    path = DATA_DIR / name
    content = json.dumps(
        json_safe(payload),
        ensure_ascii=False,
        allow_nan=False,
        indent=2,
    ) + "\n"
    path.write_text(content, encoding="utf-8")
    print(f"WROTE {path.relative_to(FRONTEND_DIR)} ({path.stat().st_size} bytes)")


def source_line(project_state: str, prefix: str) -> str:
    for line in project_state.splitlines():
        clean = line.strip()
        if clean.startswith(prefix):
            return clean
    return ""


def extract_cv_test_note(project_state: str) -> str:
    line = source_line(project_state, "- **Generalization Gap Explanation:**")
    if line:
        return line.removeprefix("- **Generalization Gap Explanation:**").strip()

    heading = "### Generalization Gap Explanation (Test R² > CV R²)"
    if heading in project_state:
        after_heading = project_state.split(heading, maxsplit=1)[1]
        for line in after_heading.splitlines():
            if line.strip().startswith("- **Cause:**"):
                return line.split(":", maxsplit=1)[1].strip()
    return "Not available"


def extract_selection_rule(project_state: str) -> str:
    start_marker = "- **Selection Rule Applied:**"
    end_marker = "- **LOCKED DECISION:**"
    if start_marker not in project_state or end_marker not in project_state:
        return "Not available"
    section = project_state.split(start_marker, maxsplit=1)[1]
    section = section.split(end_marker, maxsplit=1)[0]
    lines = [line.strip() for line in section.splitlines() if line.strip()]
    return "\n".join(lines)


def target_status(project_state: str, test_r2: float, cv_r2: float) -> dict[str, Any]:
    target_line = source_line(project_state, "- **Target Line:**")
    target_met_test = "target met: yes" in target_line.lower()
    # The target comparison is also recorded for CV in the project's Block 5 log.
    cv_line = source_line(project_state, "- Best CV R² (default models):")
    target_met_cv = "below 0.75" not in cv_line.lower() and cv_r2 >= TARGET_R2
    return {
        "threshold": TARGET_R2,
        "target_met_test": target_met_test,
        "target_met_cv": target_met_cv,
        "test_r2": test_r2,
        "cv_r2": cv_r2,
        "recorded_target_line": target_line.removeprefix("- **Target Line:**").strip(),
        "recorded_cv_status": cv_line.removeprefix("- ").strip(),
    }


def get_pipeline_details(model: Any, feature_config: dict[str, Any]) -> dict[str, Any]:
    if not hasattr(model, "named_steps") or "prep" not in model.named_steps:
        raise TypeError("final_model.joblib must contain the expected fitted pipeline.")
    estimator = model.named_steps.get("model")
    if estimator is None or type(estimator).__name__ != "LinearRegression":
        raise TypeError("Path A requires a final LinearRegression estimator.")

    preprocessor = model.named_steps["prep"]
    transformers = {name: (pipeline, columns) for name, pipeline, columns in preprocessor.transformers_}
    numeric_columns = list(feature_config["numeric_cols"])
    categorical_columns = list(feature_config["ordinal_cols"])
    scaler = transformers["num"][0].named_steps["scaler"]
    categorical_pipeline = transformers["ord"][0]
    imputer = categorical_pipeline.named_steps["imputer"]
    encoder = categorical_pipeline.named_steps["encoder"]
    column_order = list(preprocessor.get_feature_names_out())
    coefficients = {
        name: float(value)
        for name, value in zip(column_order, estimator.coef_, strict=True)
    }
    return {
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "column_order": column_order,
        "categories": {
            name: [str(value) for value in order]
            for name, order in zip(categorical_columns, encoder.categories_, strict=True)
        },
        "imputation_modes": {
            name: str(value)
            for name, value in zip(categorical_columns, imputer.statistics_, strict=True)
        },
        "scaler": {
            "columns": numeric_columns,
            "mean": [float(value) for value in scaler.mean_],
            "scale": [float(value) for value in scaler.scale_],
        },
        "coefficients": {
            "intercept": float(estimator.intercept_),
            "values": coefficients,
        },
    }


def make_presets() -> list[dict[str, Any]]:
    return [
        {
            "name": "Student A",
            "description": "High engagement and high resources",
            "inputs": {
                "Hours_Studied": 28,
                "Attendance": 95,
                "Sleep_Hours": 8,
                "Previous_Scores": 85,
                "Tutoring_Sessions": 3,
                "Physical_Activity": 4,
                "Parental_Involvement": "High",
                "Access_to_Resources": "High",
                "Motivation_Level": "High",
                "Family_Income": "High",
                "Teacher_Quality": "High",
                "Peer_Influence": "Positive",
                "Parental_Education_Level": "Postgraduate",
                "Distance_from_Home": "Near",
                "Extracurricular_Activities": "Yes",
                "Internet_Access": "Yes",
                "School_Type": "Private",
                "Learning_Disabilities": "No",
                "Gender": "Female",
            },
        },
        {
            "name": "Student B",
            "description": "Average profile with missing teacher quality",
            "inputs": {
                "Hours_Studied": 20,
                "Attendance": 80,
                "Sleep_Hours": 7,
                "Previous_Scores": 69,
                "Tutoring_Sessions": 1,
                "Physical_Activity": 3,
                "Parental_Involvement": "Medium",
                "Access_to_Resources": "Medium",
                "Motivation_Level": "Medium",
                "Family_Income": "Medium",
                "Teacher_Quality": None,
                "Peer_Influence": "Neutral",
                "Parental_Education_Level": "College",
                "Distance_from_Home": "Moderate",
                "Extracurricular_Activities": "No",
                "Internet_Access": "Yes",
                "School_Type": "Public",
                "Learning_Disabilities": "No",
                "Gender": "Male",
            },
        },
        {
            "name": "Student C",
            "description": "Low engagement and resources; learning disability",
            "inputs": {
                "Hours_Studied": 10,
                "Attendance": 65,
                "Sleep_Hours": 6,
                "Previous_Scores": 55,
                "Tutoring_Sessions": 0,
                "Physical_Activity": 1,
                "Parental_Involvement": "Low",
                "Access_to_Resources": "Low",
                "Motivation_Level": "Low",
                "Family_Income": "Low",
                "Teacher_Quality": "Low",
                "Peer_Influence": "Negative",
                "Parental_Education_Level": "High School",
                "Distance_from_Home": "Far",
                "Extracurricular_Activities": "No",
                "Internet_Access": "No",
                "School_Type": "Public",
                "Learning_Disabilities": "Yes",
                "Gender": "Male",
            },
        },
    ]


def features_spec(
    train: pd.DataFrame, details: dict[str, Any]
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for name in details["numeric_columns"]:
        values = train[name].dropna()
        result.append(
            {
                "name": name,
                "kind": "numeric",
                "min": int(values.min()),
                "max": int(values.max()),
                "median": float(values.median()),
                "step": 1,
                "label": NUMERIC_LABELS.get(name, name.replace("_", " ")),
            }
        )
    for name in details["categorical_columns"]:
        result.append(
            {
                "name": name,
                "kind": "categorical",
                "options": details["categories"][name],
                "mode": details["imputation_modes"][name],
                "label": CATEGORICAL_LABELS.get(name, name.replace("_", " ")),
            }
        )
    return result


def build_model_spec(
    model: Any,
    config: dict[str, Any],
    train: pd.DataFrame,
    error_summary: dict[str, Any],
    project_state: str,
    final_row: pd.Series,
) -> dict[str, Any]:
    details = get_pipeline_details(model, config)
    cv_r2 = float(final_row["CV_R2_mean"])
    test_r2 = float(final_row["Test_R2"])

    # Confirm the exported numbers reproduce the fitted pipeline without re-fitting it.
    first_rows = train[details["numeric_columns"] + details["categorical_columns"]].head(5)
    transformed = model.named_steps["prep"].transform(first_rows)
    manual = (
        np.asarray(transformed) @ model.named_steps["model"].coef_
        + model.named_steps["model"].intercept_
    )
    direct = model.predict(first_rows)
    if not np.allclose(manual, direct, rtol=0, atol=1e-10):
        raise AssertionError("Manual fitted-pipeline coefficient check failed.")

    categorical = {
        name: {
            "order": details["categories"][name],
            "mode": details["imputation_modes"][name],
        }
        for name in details["categorical_columns"]
    }
    return {
        "path": "A",
        "model_name": type(model.named_steps["model"]).__name__,
        "features_used": features_spec(train, details),
        "features_not_used": list(config.get("dropped_features", [])),
        "categorical": categorical,
        "engineered": ENGINEERED_FORMULAS,
        "column_order": details["column_order"],
        "imputation_modes": details["imputation_modes"],
        "scaler": details["scaler"],
        "coefficients": details["coefficients"],
        "output_clip": [0, 100],
        "uncertainty": {
            "mae": float(final_row["Test_MAE"]),
            "rmse": float(final_row["Test_RMSE"]),
            "p90_abs_error": float(error_summary["overall_metrics"]["p90_absolute_error"]),
        },
        "presets": make_presets(),
        "model_check": {
            "manual_pipeline_max_abs_difference": float(np.max(np.abs(manual - direct))),
            "engineered_features_used_by_model": list(config.get("engineered_features", [])),
        },
    }


def make_meta(
    raw: pd.DataFrame,
    clean: pd.DataFrame,
    train: pd.DataFrame,
    test: pd.DataFrame,
    final_row: pd.Series,
    error_summary: dict[str, Any],
    project_state: str,
) -> dict[str, Any]:
    cv_r2 = float(final_row["CV_R2_mean"])
    test_r2 = float(final_row["Test_R2"])
    generated_dates = re.findall(r"\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})", project_state)
    generated_on = generated_dates[-1] if generated_dates else "Not available"
    author_match = re.search(
        r"^- Author \(`([^`]+)`\):\s*(.+)$",
        project_state,
        flags=re.MULTILINE,
    )
    dataset_author = (
        f"{author_match.group(1)}: {author_match.group(2).strip()}"
        if author_match
        else "Not available"
    )
    return {
        "project_title": "Exam Stress & Performance Correlator",
        "course": "ECSCI24302 – Machine Learning Essentials",
        "dataset": {
            "name": "Student Performance Factors",
            "source": "Kaggle",
            "url": source_line(project_state, "- Kaggle URL:").removeprefix("- Kaggle URL:").strip() or "Not available",
            "author": dataset_author,
            "license": source_line(project_state, "- License:").removeprefix("- License:").strip() or "Not available",
            "date_accessed": source_line(project_state, "- Date accessed:").removeprefix("- Date accessed:").strip() or "Not available",
        },
        "n_rows_raw": int(len(raw)),
        "n_rows_clean": int(len(clean)),
        "n_rows_train": int(len(train)),
        "n_rows_test": int(len(test)),
        "n_columns": int(clean.shape[1]),
        "target": TARGET,
        "target_stats": {
            "mean": float(clean[TARGET].mean()),
            "std": float(clean[TARGET].std()),
            "min": int(clean[TARGET].min()),
            "max": int(clean[TARGET].max()),
        },
        "final_model": {
            "name": str(final_row["Model"]),
            "cv_r2": cv_r2,
            "cv_r2_std": float(final_row["CV_R2_std"]),
            "test_r2": test_r2,
            "test_mae": float(final_row["Test_MAE"]),
            "test_mse": float(final_row["Test_MSE"]),
            "test_rmse": float(final_row["Test_RMSE"]),
            "p90_abs_error": float(error_summary["overall_metrics"]["p90_absolute_error"]),
        },
        "target_r2": TARGET_R2,
        "target_met_test": "target met: yes" in source_line(
            project_state, "- **Target Line:**"
        ).lower(),
        "target_met_cv": cv_r2 >= TARGET_R2,
        "cv_vs_test_note": extract_cv_test_note(project_state),
        "not_in_dataset": ["stress level", "screen time", "CGPA"],
        "generated_on": generated_on,
    }


def numeric_histograms(clean: pd.DataFrame) -> dict[str, Any]:
    output: dict[str, Any] = {}
    columns = clean.select_dtypes(include=[np.number]).columns.tolist()
    for column in columns:
        values = clean[column].dropna().to_numpy(dtype=float)
        counts, edges = np.histogram(values, bins=20)
        output[column] = {
            "bin_edges": edges.tolist(),
            "counts": counts.astype(int).tolist(),
        }
    return output


def categorical_eda(
    clean: pd.DataFrame, orders: dict[str, list[str]]
) -> tuple[dict[str, Any], dict[str, Any]]:
    counts_by_column: dict[str, Any] = {}
    means_by_column: dict[str, Any] = {}
    for column, order in orders.items():
        values = clean[column].fillna("Missing").astype(str)
        levels = list(order)
        if (values == "Missing").any():
            levels.append("Missing")
        counts_by_column[column] = [
            {
                "level": level,
                "count": int((values == level).sum()),
                "percent": float((values == level).mean() * 100),
            }
            for level in levels
        ]
        rows = []
        for level in levels:
            group = clean.loc[values == level, TARGET]
            rows.append(
                {
                    "level": level,
                    "n": int(group.count()),
                    "mean": finite_number(group.mean()),
                    "std": finite_number(group.std()),
                }
            )
        means_by_column[column] = rows
    return counts_by_column, means_by_column


def scatter_data(clean: pd.DataFrame, numeric_features: list[str]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for column in numeric_features:
        complete = clean[[column, TARGET]].dropna()
        sample = complete.sample(
            n=min(1200, len(complete)),
            random_state=42,
        )
        pearson = pearsonr(complete[column], complete[TARGET]).statistic
        spearman = spearmanr(complete[column], complete[TARGET]).statistic
        fitted = linregress(complete[column], complete[TARGET])
        output[column] = {
            "points": sample[[column, TARGET]].astype(float).values.tolist(),
            "pearson": float(pearson),
            "spearman": float(spearman),
            "fitted_line": {
                "slope": float(fitted.slope),
                "intercept": float(fitted.intercept),
            },
            "sampled": len(complete) > 1200,
            "n_total": int(len(complete)),
            "random_state": 42,
        }
    return output


def binned_means(clean: pd.DataFrame) -> dict[str, Any]:
    bin_specs = {
        "Hours_Studied": (
            [0, 10, 15, 20, 25, 30, 50],
            ["<=10", "11-15", "16-20", "21-25", "26-30", "31+"],
        ),
        "Attendance": (
            [59, 69, 79, 89, 100],
            ["60-69", "70-79", "80-89", "90-100"],
        ),
        "Sleep_Hours": (
            [3, 5, 7, 9, 11],
            ["4-5", "6-7", "8-9", "10"],
        ),
        "Previous_Scores": (
            [49, 59, 69, 79, 89, 101],
            ["50-59", "60-69", "70-79", "80-89", "90-100"],
        ),
    }
    output: dict[str, Any] = {}
    for column, (edges, labels) in bin_specs.items():
        bins = pd.cut(clean[column], bins=edges, labels=labels, include_lowest=True)
        grouped = clean.assign(_bin=bins).groupby("_bin", observed=False)[TARGET]
        output[column] = [
            {
                "bin": str(label),
                "n": int(grouped.count().get(label, 0)),
                "mean": finite_number(grouped.mean().get(label)),
            }
            for label in labels
        ]
    return output


def make_eda(
    clean: pd.DataFrame,
    quality: dict[str, Any],
    config: dict[str, Any],
    validation: dict[str, Any],
) -> dict[str, Any]:
    categorical_counts, group_means = categorical_eda(
        clean, config["category_orders"]
    )
    numeric_features = list(config["numeric_cols"])
    quality_copy = dict(quality)
    quality_copy["rows_removed"] = int(validation.get("n_exam_score_over_100", 0))
    quality_copy["rows_removed_reason"] = (
        "Exam_Score above 100 is outside the valid 0–100 score domain."
    )
    return {
        "numeric_hist": numeric_histograms(clean),
        "categorical_counts": categorical_counts,
        "group_means": group_means,
        "scatter": scatter_data(clean, numeric_features),
        "binned_means": binned_means(clean),
        "data_quality": quality_copy,
    }


def make_correlations(
    clean: pd.DataFrame, config: dict[str, Any], details: dict[str, Any], table: pd.DataFrame
) -> dict[str, Any]:
    rows = [
        {
            "feature": str(row["feature"]),
            "pearson": finite_number(row["pearson_r"]),
            "spearman": finite_number(row["spearman_rho"]),
            "direction": str(row["direction"]),
            "strength": str(row["strength"]),
        }
        for _, row in table.iterrows()
    ]
    encoded = pd.DataFrame(index=clean.index)
    for column in details["numeric_columns"]:
        encoded[column] = clean[column]
    for column in details["categorical_columns"]:
        order = details["categories"][column]
        mapping = {category: index for index, category in enumerate(order)}
        mode = details["imputation_modes"][column]
        encoded[column] = clean[column].fillna(mode).map(mapping)
    encoded[TARGET] = clean[TARGET]
    correlation = encoded.corr(method="pearson")
    return {
        "table": rows,
        "matrix": {
            "labels": correlation.columns.tolist(),
            "values": correlation.round(3).values.tolist(),
        },
    }


def make_models(
    comparison: pd.DataFrame,
    cv_results: pd.DataFrame,
    tuning: dict[str, Any],
    final_row: pd.Series,
    project_state: str,
) -> dict[str, Any]:
    cv_default = cv_results.loc[cv_results["stage"] == "default"]
    cv_r2 = float(final_row["CV_R2_mean"])
    test_r2 = float(final_row["Test_R2"])
    return {
        "final_table": comparison.to_dict(orient="records"),
        "cv": {
            "stage": "default",
            "rows": cv_default.to_dict(orient="records"),
            "per_fold_r2": [],
            "per_fold_r2_note": "Per-fold R² values were not saved in cv_results.csv.",
        },
        "tuning": tuning,
        "selected_model": str(final_row["Model"]),
        "selection_rule_text": extract_selection_rule(project_state),
        "target_status": target_status(project_state, test_r2, cv_r2),
    }


def make_importance(
    importance: pd.DataFrame,
    model: Any,
    column_order: list[str],
) -> dict[str, Any]:
    permutation = [
        {
            "feature": str(row["Feature"]),
            "mean_decrease_r2": float(row["Importance_Mean"]),
            "std": float(row["Importance_Std"]),
            "rank": int(row["Rank"]),
        }
        for _, row in importance.sort_values("Rank").iterrows()
    ]
    coefficient_rows = []
    for column, value in zip(column_order, model.named_steps["model"].coef_, strict=True):
        feature = column.split("__", maxsplit=1)[-1]
        coefficient_rows.append(
            {
                "feature": feature,
                "coefficient": float(value),
                "sign": "positive" if value > 0 else "negative" if value < 0 else "zero",
            }
        )
    coefficient_rows.sort(key=lambda row: abs(row["coefficient"]), reverse=True)
    return {
        "permutation": permutation,
        "coefficients": coefficient_rows,
        "tree": [],
        "note": "Predictive importance is not causal importance.",
    }


def make_errors(
    error_summary: dict[str, Any],
    predictions: pd.DataFrame,
    test: pd.DataFrame,
) -> tuple[dict[str, Any], dict[str, Any]]:
    actual = predictions["actual"].to_numpy(dtype=float)
    predicted = predictions["final_model_pred"].to_numpy(dtype=float)
    residual = actual - predicted
    absolute_error = np.abs(residual)
    bins = [-np.inf, 59.99, 64.99, 69.99, 74.99, 79.99, np.inf]
    labels = ["Below 60", "60-64", "65-69", "70-74", "75-79", "80+"]

    actual_bin_data = error_summary.get("error_by_actual_bin", [])
    by_actual_range = [
        {
            "range": str(row["Actual Score Bin"]),
            "n": int(row["Count"]),
            "mae": finite_number(row["MAE"]),
            "mean_residual": finite_number(row["Mean Residual (Bias)"]),
        }
        for row in actual_bin_data
    ]

    predicted_bins = pd.cut(predicted, bins=bins, labels=labels)
    by_predicted_range = []
    for label in labels:
        mask = np.asarray(predicted_bins == label)
        by_predicted_range.append(
            {
                "range": label,
                "n": int(mask.sum()),
                "mae": finite_number(absolute_error[mask].mean()) if mask.any() else None,
                "mean_residual": finite_number(residual[mask].mean()) if mask.any() else None,
            }
        )

    largest_indices = np.argsort(absolute_error)[::-1][:15]
    feature_columns = [
        column for column in test.columns if column != TARGET and not column in {
            "Study_x_Attendance", "Sleep_Deficit", "Sleep_Category",
            "Has_Tutoring", "Study_per_Sleep", "Active_Total",
        }
    ]
    largest_errors = []
    for index in largest_indices:
        row_index = int(predictions.iloc[index]["row_index_in_test"])
        largest_errors.append(
            {
                "row_index_in_test": row_index,
                "actual": float(actual[index]),
                "predicted": float(predicted[index]),
                "residual": float(residual[index]),
                "abs_error": float(absolute_error[index]),
                "features": test.iloc[row_index][feature_columns].to_dict(),
            }
        )
    counts, edges = np.histogram(residual, bins=20)
    errors = {
        "summary": error_summary["overall_metrics"],
        "by_actual_range": by_actual_range,
        "by_predicted_range": by_predicted_range,
        "by_group": error_summary.get("flagged_groups", []),
        "largest_errors": largest_errors,
        "histogram": {"bin_edges": edges.tolist(), "counts": counts.astype(int).tolist()},
        "residual_definition": "actual - predicted",
    }
    n_rows = len(actual)
    test_points = {
        "actual": actual.tolist(),
        "predicted": predicted.tolist(),
        "residual": residual.tolist(),
        "Attendance": test["Attendance"].astype(float).tolist(),
        "Hours_Studied": test["Hours_Studied"].astype(float).tolist(),
        "Previous_Scores": test["Previous_Scores"].astype(float).tolist(),
        "Motivation_Level": test["Motivation_Level"].fillna("Missing").astype(str).tolist(),
        "sampled": False,
        "n_total": n_rows,
        "label": "held-out test set (20%)",
    }
    if len(json.dumps(test_points, allow_nan=False).encode("utf-8")) > 400 * 1024:
        sample_indices = np.random.RandomState(42).choice(
            n_rows,
            size=min(1200, n_rows),
            replace=False,
        )
        test_points = {
            key: (
                [value[index] for index in sample_indices]
                if isinstance(value, list) and len(value) == n_rows
                else value
            )
            for key, value in test_points.items()
        }
        test_points["sampled"] = True
        test_points["n_total"] = n_rows
        test_points["sample_indices"] = sample_indices.astype(int).tolist()
    return errors, test_points


def parse_viva(text: str) -> list[dict[str, str]]:
    questions: list[dict[str, str]] = []
    group = "General"
    current_question: str | None = None
    answer_lines: list[str] = []

    def save_current() -> None:
        if current_question is None:
            return
        answer = "\n".join(answer_lines).strip()
        answer = re.sub(r"^\*\*Answer:\*\*\s*", "", answer, count=1)
        questions.append(
            {"group": group, "question": current_question, "answer": answer}
        )

    for line in text.splitlines():
        if line.startswith("### "):
            save_current()
            current_question = None
            answer_lines = []
            group = line[4:].strip()
        elif line.startswith("#### Q"):
            save_current()
            current_question = line[5:].strip()
            answer_lines = []
        elif current_question is not None:
            if line.strip() == "---":
                save_current()
                current_question = None
                answer_lines = []
            else:
                answer_lines.append(line)
    save_current()
    if not questions:
        raise ValueError("No viva questions could be parsed from reports/viva_questions.md.")
    return questions


def main() -> None:
    require_inputs()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    raw = pd.read_csv(SOURCE_DATA_DIR / "raw_dataset.csv")
    clean = pd.read_csv(SOURCE_DATA_DIR / "cleaned_dataset.csv")
    train = pd.read_csv(SOURCE_DATA_DIR / "train.csv")
    test = pd.read_csv(SOURCE_DATA_DIR / "test.csv")
    project_state = (OUTPUT_DIR / "PROJECT_STATE.md").read_text(encoding="utf-8")
    config = read_json(OUTPUT_DIR / "feature_config.json")
    validation = read_json(OUTPUT_DIR / "dataset_validation.json")
    quality = read_json(OUTPUT_DIR / "data_quality_summary.json")
    tuning = read_json(OUTPUT_DIR / "tuning_results.json")
    error_summary = read_json(OUTPUT_DIR / "error_analysis_summary.json")
    comparison = pd.read_csv(OUTPUT_DIR / "final_comparison_table.csv")
    cv_results = pd.read_csv(OUTPUT_DIR / "cv_results.csv")
    correlation_table = pd.read_csv(OUTPUT_DIR / "correlation_table.csv")
    importance = pd.read_csv(OUTPUT_DIR / "feature_importance.csv")
    predictions = pd.read_csv(OUTPUT_DIR / "test_predictions.csv")
    model = joblib.load(OUTPUT_DIR / "final_model.joblib")
    model_name = type(model.named_steps["model"]).__name__
    matching_rows = comparison.loc[comparison["Model"] == model_name]
    if matching_rows.empty:
        raise ValueError(f"No comparison-table row found for final model {model_name!r}.")
    final_row = matching_rows.iloc[0]
    details = get_pipeline_details(model, config)

    meta = make_meta(
        raw, clean, train, test, final_row, error_summary, project_state
    )
    model_spec = build_model_spec(
        model, config, train, error_summary, project_state, final_row
    )
    eda = make_eda(clean, quality, config, validation)
    correlations = make_correlations(clean, config, details, correlation_table)
    models = make_models(comparison, cv_results, tuning, final_row, project_state)
    importance_data = make_importance(
        importance, model, details["column_order"]
    )
    errors, test_points = make_errors(error_summary, predictions, test)
    viva = parse_viva((REPORTS_DIR / "viva_questions.md").read_text(encoding="utf-8"))

    outputs = {
        "meta.json": meta,
        "model_spec.json": model_spec,
        "eda.json": eda,
        "correlations.json": correlations,
        "models.json": models,
        "importance.json": importance_data,
        "errors.json": errors,
        "test_points.json": test_points,
        "viva.json": viva,
    }
    for name, payload in outputs.items():
        write_json(name, payload)


if __name__ == "__main__":
    main()
