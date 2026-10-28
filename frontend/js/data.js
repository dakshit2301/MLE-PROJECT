/*
Purpose: Load and cache generated frontend JSON with clear errors.
Inputs: JSON filenames under frontend/data.
Outputs: Parsed data or a typed error with the regenerate command.
*/
const cache = new Map();

export class DataLoadError extends Error {
  constructor(file, cause) {
    super(
      `Could not load ${file}. Try regenerating the frontend data with: python export_data.py`,
      { cause },
    );
    this.name = "DataLoadError";
    this.file = file;
    this.command = "python export_data.py";
  }
}

export async function loadJSON(name) {
  if (cache.has(name)) return cache.get(name);

  const request = (async () => {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`data/${encodeURIComponent(name)}`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while loading ${name}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw new DataLoadError(name, lastError);
  })();

  cache.set(name, request);
  try {
    return await request;
  } catch (error) {
    cache.delete(name);
    throw error;
  }
}

export async function loadAll() {
  const [meta, modelSpec] = await Promise.all([
    loadJSON("meta.json"),
    loadJSON("model_spec.json"),
  ]);
  return { meta, modelSpec };
}
