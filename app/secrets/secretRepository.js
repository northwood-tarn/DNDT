import { createSecretDefinition, validateSecretCatalogue } from "./secretDefinition.js";

export async function loadSecretCatalogue(options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A fetch implementation is required");
  const indexResponse = await fetcher(options.indexPath || "/data/secrets/index.json");
  if (!indexResponse?.ok) throw new Error(`Unable to load secret catalogue index: HTTP ${indexResponse?.status || "unknown"}`);
  const files = await indexResponse.json();
  const definitions = [];
  for (const file of files) {
    const response = await fetcher(`/data/secrets/${file}`);
    if (!response?.ok) throw new Error(`Unable to load secret definition ${file}`);
    definitions.push(createSecretDefinition(await response.json()));
  }
  const errors = validateSecretCatalogue(definitions);
  if (errors.length) throw new Error(`Invalid secret catalogue: ${errors.join("; ")}`);
  return definitions;
}
