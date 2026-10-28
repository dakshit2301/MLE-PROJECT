"""Validate generated frontend JSON keys, numeric values, and total size."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any


FRONTEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = FRONTEND_DIR / "data"
MAX_TOTAL_BYTES = 1_500_000
REQUIRED_KEYS = {
    "meta.json": {
        "project_title", "dataset", "n_rows_raw", "n_rows_clean",
        "n_rows_train", "n_rows_test", "target", "target_stats",
        "final_model", "target_r2", "cv_vs_test_note",
    },
    "model_spec.json": {
        "path", "model_name", "features_used", "features_not_used",
        "categorical", "engineered", "column_order", "imputation_modes",
        "scaler", "coefficients", "output_clip", "uncertainty", "presets",
    },
    "eda.json": {
        "numeric_hist", "categorical_counts", "group_means", "scatter",
        "binned_means", "data_quality",
    },
    "correlations.json": {"table", "matrix"},
    "models.json": {
        "final_table", "cv", "tuning", "selected_model",
        "selection_rule_text", "target_status",
    },
    "importance.json": {"permutation", "coefficients", "tree", "note"},
    "errors.json": {
        "summary", "by_actual_range", "by_predicted_range",
        "by_group", "largest_errors", "histogram",
    },
    "test_points.json": {
        "actual", "predicted", "residual", "Attendance",
        "Hours_Studied", "Previous_Scores", "Motivation_Level",
    },
    "viva.json": None,
}


def validate_finite(value: Any, location: str) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            validate_finite(child, f"{location}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_finite(child, f"{location}[{index}]")
    elif isinstance(value, bool) or value is None or isinstance(value, str):
        return
    elif isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise ValueError(f"Non-finite number at {location}: {value!r}")


def reject_constant(value: str) -> None:
    raise ValueError(f"Invalid JSON constant: {value}")


def main() -> int:
    failures = []
    total_bytes = 0
    for name, required_keys in REQUIRED_KEYS.items():
        path = DATA_DIR / name
        if not path.is_file():
            failures.append(f"Missing JSON file: {name}")
            continue
        total_bytes += path.stat().st_size
        try:
            data = json.loads(
                path.read_text(encoding="utf-8"),
                parse_constant=reject_constant,
            )
            if required_keys is not None:
                if not isinstance(data, dict):
                    failures.append(f"{name}: expected a JSON object.")
                else:
                    missing = required_keys - set(data)
                    if missing:
                        failures.append(f"{name}: missing keys {sorted(missing)}.")
            elif not isinstance(data, list):
                failures.append(f"{name}: expected a JSON array.")
            elif name == "viva.json" and any(
                not isinstance(item, dict)
                or not {"group", "question", "answer"}.issubset(item)
                for item in data
            ):
                failures.append(
                    "viva.json: every item must contain group, question, and answer."
                )
            if name == "test_points.json" and isinstance(data, dict):
                arrays = [
                    data[key]
                    for key in (
                        "actual", "predicted", "residual", "Attendance",
                        "Hours_Studied", "Previous_Scores", "Motivation_Level",
                    )
                ]
                if len({len(values) for values in arrays}) != 1:
                    failures.append(
                        "test_points.json: required held-out arrays have different lengths."
                    )
            validate_finite(data, name)
            print(f"OK {name} ({path.stat().st_size} bytes)")
        except (OSError, json.JSONDecodeError, ValueError) as error:
            failures.append(f"{name}: {error}")

    extra = sorted(path.name for path in DATA_DIR.glob("*.json") if path.name not in REQUIRED_KEYS)
    if extra:
        failures.append(f"Unexpected JSON file(s): {', '.join(extra)}")
    print(f"TOTAL JSON SIZE: {total_bytes} bytes (limit {MAX_TOTAL_BYTES} bytes)")
    if total_bytes >= MAX_TOTAL_BYTES:
        failures.append("Generated JSON directory is not under 1.5 MB.")
    if failures:
        for failure in failures:
            print(f"FAIL {failure}")
        print("SCHEMA CHECK FAILED")
        return 1
    print("SCHEMA CHECK PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
