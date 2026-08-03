export const SECRET_STAGES = Object.freeze(["hidden", "searching", "uncovered", "unlocked", "completed"]);
export const SECRET_EFFECT_TYPES = Object.freeze(["reveal.discovery", "set.flag", "start.quest", "quest.objective", "enable.dialogue", "enable.encounter"]);

export function createSecretDefinition(input = {}) {
  return {
    id: input.id || null,
    title: input.title || "",
    target: { id: input.target?.id || null, label: input.target?.label || "" },
    clueThreshold: Math.max(1, Math.floor(Number(input.clueThreshold) || 1)),
    clues: (input.clues || []).map((clue) => ({
      id: clue.id || null,
      name: clue.name || "",
      description: clue.description || "",
      source: normalizeClueSource(clue.source),
    })),
    inventory: { searchingText: input.inventory?.searchingText || "" },
    journal: {
      searching: input.journal?.searching || "",
      milestones: (input.journal?.milestones || []).map((entry) => ({ count: Math.max(1, Math.floor(Number(entry.count) || 1)), text: entry.text || "" })),
      uncovered: input.journal?.uncovered || "",
      unlocked: input.journal?.unlocked || "",
      completed: input.journal?.completed || "",
    },
    rewardItems: unique(input.rewardItems || []),
    unlockRequirements: (input.unlockRequirements || []).map((requirement) => structuredClone(requirement)),
    effects: Object.fromEntries(["uncovered", "unlocked", "completed"].map((stage) => [stage, (input.effects?.[stage] || []).map((effect) => structuredClone(effect))])),
    metadata: structuredClone(input.metadata || {}),
  };
}

export function validateSecretDefinition(input, options = {}) {
  const secret = createSecretDefinition(input);
  const errors = [];
  if (!stableId(secret.id, "secret")) errors.push("id must use secret:lowercase.words");
  if (!secret.title) errors.push("title is required");
  if (!stableId(secret.target.id, "location")) errors.push("target.id must use location:lowercase.words");
  if (!secret.target.label) errors.push("target.label is required");
  if (!secret.inventory.searchingText) errors.push("inventory.searchingText is required");
  if (!secret.journal.searching || !secret.journal.uncovered) errors.push("journal.searching and journal.uncovered are required");
  const clueIds = new Set();
  for (const clue of secret.clues) {
    if (!stableId(clue.id, "clue")) errors.push(`invalid clue id: ${clue.id}`);
    if (clueIds.has(clue.id)) errors.push(`duplicate clue id: ${clue.id}`);
    clueIds.add(clue.id);
    if (!clue.name || !clue.description) errors.push(`clue ${clue.id || "(missing)"} requires name and description`);
    errors.push(...validateClueSource(clue.source).map((error) => `clue ${clue.id || "(missing)"}: ${error}`));
    if (options.hasReference && clue.source?.id && !options.hasReference(`clue.${clue.source.type}`, clue.source.id, clue.source)) errors.push(`unresolved ${clue.source.type} source: ${clue.source.id}`);
  }
  if (secret.clueThreshold > secret.clues.length) errors.push("clueThreshold cannot exceed the number of clues");
  const milestoneCounts = new Set();
  for (const milestone of secret.journal.milestones) {
    if (milestone.count >= secret.clueThreshold) errors.push(`journal milestone ${milestone.count} must be below clueThreshold`);
    if (milestoneCounts.has(milestone.count)) errors.push(`duplicate journal milestone ${milestone.count}`);
    milestoneCounts.add(milestone.count);
    if (!milestone.text) errors.push(`journal milestone ${milestone.count} requires text`);
  }
  for (const stage of ["uncovered", "unlocked", "completed"]) for (const effect of secret.effects[stage]) {
    if (!SECRET_EFFECT_TYPES.includes(effect.type)) errors.push(`unsupported ${stage} effect: ${effect.type}`);
    if (!effect.id) errors.push(`${stage} effect ${effect.type || "(missing)"} requires an id`);
    if (options.hasReference && effect.id && !options.hasReference(effect.type, effect.id)) errors.push(`unresolved ${effect.type} reference: ${effect.id}`);
  }
  return errors;
}

export function validateSecretCatalogue(inputs, options = {}) {
  const definitions = (inputs || []).map(createSecretDefinition), errors = [], secretIds = new Set(), clueOwners = new Map();
  for (const secret of definitions) {
    errors.push(...validateSecretDefinition(secret, options).map((error) => `${secret.id || "(missing secret)"}: ${error}`));
    if (secretIds.has(secret.id)) errors.push(`duplicate secret id: ${secret.id}`);
    secretIds.add(secret.id);
    for (const clue of secret.clues) {
      if (clueOwners.has(clue.id)) errors.push(`clue ${clue.id} belongs to both ${clueOwners.get(clue.id)} and ${secret.id}`);
      clueOwners.set(clue.id, secret.id);
    }
  }
  const edges = new Map(definitions.map((secret) => [secret.id, secret.unlockRequirements.filter((entry) => entry.type === "secret").map((entry) => entry.id)]));
  const visiting = new Set(), visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) { errors.push(`secret dependency cycle: ${[...path, id].join(" -> ")}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of edges.get(id) || []) { if (!edges.has(dependency)) errors.push(`${id}: unknown secret dependency ${dependency}`); else visit(dependency, [...path, id]); }
    visiting.delete(id); visited.add(id);
  }
  for (const id of edges.keys()) visit(id);
  return [...new Set(errors)];
}

export function getSecretClue(secret, clueId) { return createSecretDefinition(secret).clues.find((clue) => clue.id === clueId) || null; }
export function stableId(value, prefix) { return typeof value === "string" && new RegExp(`^${prefix}:[a-z0-9]+(?:[._-][a-z0-9]+)*$`).test(value); }
export function normalizeClueSource(input = {}) {
  const type = input.type || null;
  return {
    type,
    id: input.id || null,
    ...(type === "node" ? { mapId: input.mapId || null } : {}),
  };
}
export function validateClueSource(source) {
  if (!source?.type) return ["source is required"];
  if (!["conversation", "item", "node", "loot"].includes(source.type)) return [`invalid source type: ${source.type}`];
  if (!source.id) return [`${source.type} source requires an id`];
  if (source.type === "node" && !source.mapId) return ["node source requires a mapId"];
  return [];
}
function unique(values) { return [...new Set(values.filter(Boolean))]; }
