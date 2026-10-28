"""Compare the frontend predictor against the saved final model."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


FRONTEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = FRONTEND_DIR.parent
DATA_DIR = FRONTEND_DIR / "data"
OUTPUT_DIR = PROJECT_DIR / "outputs"
SOURCE_DATA_DIR = PROJECT_DIR / "data"
TARGET = "Exam_Score"
TOLERANCE = 1e-6

NODE_SCRIPT = """
import { predictBatch, predict, sweep } from "./js/predictor.js";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const rows = JSON.parse(input);
const results = predictBatch(rows);
const edge = predict({
  ...rows[0],
  Hours_Studied: 9999,
  Attendance: 9999,
  Previous_Scores: 9999,
});
const sweepResults = sweep(rows[0], "Hours_Studied", [10, 20, 30]);
process.stdout.write(JSON.stringify({ results, edge, sweepCount: sweepResults.length }));
"""


def python_spec_predict(inputs: dict[str, Any], spec: dict[str, Any]) -> float:
    values = dict(inputs)
    for name, mode in spec["imputation_modes"].items():
        if values.get(name) is None or pd.isna(values.get(name)):
            values[name] = mode
    transformed: dict[str, float] = {}
    for name, mean, scale in zip(
        spec["scaler"]["columns"],
        spec["scaler"]["mean"],
        spec["scaler"]["scale"],
        strict=True,
    ):
        transformed[f"num__{name}"] = (float(values[name]) - mean) / scale
    for name, details in spec["categorical"].items():
        transformed[f"ord__{name}"] = details["order"].index(values[name])
    return float(
        spec["coefficients"]["intercept"]
        + sum(
            transformed[column] * spec["coefficients"]["values"][column]
            for column in spec["column_order"]
        )
    )


def verify_engineered_features(test: pd.DataFrame) -> None:
    computed = {
        "Study_x_Attendance": test["Hours_Studied"] * test["Attendance"] / 100,
        "Sleep_Deficit": (7 - test["Sleep_Hours"]).clip(lower=0),
        "Sleep_Category": np.where(
            test["Sleep_Hours"] < 6,
            0,
            np.where(test["Sleep_Hours"] <= 8, 1, 2),
        ),
        "Has_Tutoring": (test["Tutoring_Sessions"] > 0).astype(int),
        "Study_per_Sleep": test["Hours_Studied"] / test["Sleep_Hours"],
        "Active_Total": test["Physical_Activity"]
        + (test["Extracurricular_Activities"] == "Yes").astype(int),
    }
    for column, values in computed.items():
        if column not in test:
            raise AssertionError(f"Stored engineered column {column!r} is missing from test.csv.")
        if not np.allclose(
            np.asarray(values, dtype=float),
            test[column].to_numpy(dtype=float),
            rtol=0,
            atol=1e-10,
        ):
            raise AssertionError(f"Engineered feature check failed for {column}.")
    print("ENGINEERED FEATURES PASSED (6 columns match test.csv)")


def json_rows(frame: pd.DataFrame, columns: list[str]) -> list[dict[str, Any]]:
    return json.loads(frame[columns].to_json(orient="records"))


def main() -> int:
    spec = json.loads((DATA_DIR / "model_spec.json").read_text(encoding="utf-8"))
    config = json.loads((OUTPUT_DIR / "feature_config.json").read_text(encoding="utf-8"))
    test = pd.read_csv(SOURCE_DATA_DIR / "test.csv")
    model = joblib.load(OUTPUT_DIR / "final_model.joblib")
    feature_columns = config["numeric_cols"] + config["ordinal_cols"]
    if len(test) < 100:
        raise AssertionError("test.csv must contain at least 100 rows.")

    sampled = test.sample(n=100, random_state=42)
    missing = test.loc[test[config["ordinal_cols"]].isna().any(axis=1)].head(3)
    if len(missing) < 3:
        raise AssertionError("Fewer than 3 test rows have a missing categorical value.")

    requests = json_rows(sampled, feature_columns)
    labels = [f"test row {index}" for index in sampled.index]
    requests.extend(preset["inputs"] for preset in spec["presets"])
    labels.extend(preset["name"] for preset in spec["presets"])
    requests.extend(json_rows(missing, feature_columns))
    labels.extend([f"missing-category row {index}" for index in missing.index])

    expected_frames = [
        sampled[feature_columns],
        pd.DataFrame([preset["inputs"] for preset in spec["presets"]])[feature_columns],
        missing[feature_columns],
    ]
    expected = np.concatenate(
        [model.predict(frame) for frame in expected_frames]
    )

    node = shutil.which("node")
    if node:
        result = subprocess.run(
            [node, "--input-type=module", "-e", NODE_SCRIPT],
            cwd=FRONTEND_DIR,
            input=json.dumps(requests, allow_nan=False),
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(
                "Node predictor failed:\n"
                + result.stderr.strip()
                + result.stdout.strip()
            )
        js_output = json.loads(result.stdout)
        results = js_output["results"]
        actual = np.asarray([row["raw"] for row in results], dtype=float)
        for row in results:
            if (
                not isinstance(row.get("clipped"), (int, float))
                or len(row.get("band_mae", [])) != 2
                or len(row.get("band_rmse", [])) != 2
                or not isinstance(row.get("warnings"), list)
            ):
                raise AssertionError("Predictor result does not match the required output shape.")
        edge = js_output["edge"]
        if edge["clipped"] != 100 or not any(
            "outside the range the model saw; prediction less reliable" in warning
            for warning in edge["warnings"]
        ):
            raise AssertionError("Out-of-training-range warning or 0–100 display clipping failed.")
        if js_output["sweepCount"] != 3:
            raise AssertionError("sweep() did not return one prediction per input value.")
        predictor_label = "JS"
    else:
        actual = np.asarray(
            [python_spec_predict(row, spec) for row in requests],
            dtype=float,
        )
        predictor_label = "Python model_spec fallback (JS not tested)"

    differences = np.abs(expected - actual)
    max_difference = float(differences.max())
    print(f"Predictor: {predictor_label}")
    print("Sample comparison (first 10 rows)")
    print(f"{'case':38} {'Python model':>14} {predictor_label:>14} {'abs diff':>12}")
    for label, expected_value, actual_value, difference in zip(
        labels[:10], expected[:10], actual[:10], differences[:10], strict=True
    ):
        print(
            f"{label[:38]:38} {expected_value:14.8f} "
            f"{actual_value:14.8f} {difference:12.3g}"
        )
    print(f"Maximum absolute difference: {max_difference:.12g}")
    verify_engineered_features(test)
    if max_difference >= TOLERANCE:
        print("PARITY FAILED")
        return 1
    print("PARITY PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
