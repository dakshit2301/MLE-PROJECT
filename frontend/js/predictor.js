/*
Purpose: Reproduce the saved linear model in the browser.
Inputs: Model specification and feature values from the user.
Outputs: Predictions, range warnings, batches, and what-if sweeps.
*/
import modelSpec from "../data/model_spec.json" with { type: "json" };

const numericFeatures = modelSpec.features_used.filter(
  (feature) => feature.kind === "numeric",
);
const categoricalFeatures = modelSpec.features_used.filter(
  (feature) => feature.kind === "categorical",
);

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

function engineerFeatures(inputs) {
  const sleepHours = Number(inputs.Sleep_Hours);
  return {
    Study_x_Attendance: Number(inputs.Hours_Studied) * Number(inputs.Attendance) / 100,
    Sleep_Deficit: Math.max(0, 7 - sleepHours),
    Sleep_Category: sleepHours < 6 ? 0 : sleepHours <= 8 ? 1 : 2,
    Has_Tutoring: Number(inputs.Tutoring_Sessions) > 0 ? 1 : 0,
    Study_per_Sleep: sleepHours === 0
      ? 0
      : Number(inputs.Hours_Studied) / sleepHours,
    Active_Total: Number(inputs.Physical_Activity)
      + (inputs.Extracurricular_Activities === "Yes" ? 1 : 0),
  };
}

function prepareValues(inputs) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new TypeError("Prediction input must be an object of feature values.");
  }

  const values = { ...inputs };
  for (const feature of categoricalFeatures) {
    if (isMissing(values[feature.name])) {
      values[feature.name] = modelSpec.imputation_modes[feature.name];
    }
    const options = modelSpec.categorical[feature.name].order;
    if (!options.includes(values[feature.name])) {
      throw new RangeError(
        `Unsupported value for ${feature.name}: ${String(values[feature.name])}`,
      );
    }
  }

  for (const feature of numericFeatures) {
    const value = Number(values[feature.name]);
    if (!Number.isFinite(value)) {
      throw new TypeError(`A finite numeric value is required for ${feature.name}.`);
    }
    values[feature.name] = value;
  }

  values._engineered = engineerFeatures(values);
  return values;
}

export function describeInputIssues(inputs) {
  const warnings = [];
  for (const feature of numericFeatures) {
    const value = Number(inputs?.[feature.name]);
    if (
      Number.isFinite(value)
      && (value < feature.min || value > feature.max)
    ) {
      warnings.push(
        `${feature.label} is outside the range the model saw; prediction less reliable.`,
      );
    }
  }
  return warnings;
}

export function predict(inputs) {
  const values = prepareValues(inputs);
  const scaled = new Map();
  modelSpec.scaler.columns.forEach((name, index) => {
    scaled.set(
      `num__${name}`,
      (values[name] - modelSpec.scaler.mean[index]) / modelSpec.scaler.scale[index],
    );
  });
  for (const feature of categoricalFeatures) {
    const order = modelSpec.categorical[feature.name].order;
    scaled.set(`ord__${feature.name}`, order.indexOf(values[feature.name]));
  }

  let raw = modelSpec.coefficients.intercept;
  for (const column of modelSpec.column_order) {
    const inputValue = scaled.get(column);
    if (inputValue === undefined) {
      throw new Error(`The fitted model column ${column} is not supported.`);
    }
    raw += inputValue * modelSpec.coefficients.values[column];
  }

  const [minOutput, maxOutput] = modelSpec.output_clip;
  const mae = modelSpec.uncertainty.mae;
  const rmse = modelSpec.uncertainty.rmse;
  return {
    raw,
    clipped: Math.min(maxOutput, Math.max(minOutput, raw)),
    band_mae: [raw - mae, raw + mae],
    band_rmse: [raw - rmse, raw + rmse],
    warnings: describeInputIssues(values),
  };
}

export function predictBatch(inputsArray) {
  if (!Array.isArray(inputsArray)) {
    throw new TypeError("Batch prediction input must be an array.");
  }
  return inputsArray.map((inputs) => predict(inputs));
}

export function sweep(inputs, featureName, values) {
  if (!Array.isArray(values)) {
    throw new TypeError("Sweep values must be an array.");
  }
  return values.map((value) => predict({ ...inputs, [featureName]: value }));
}
