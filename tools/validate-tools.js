#!/usr/bin/env node

const DEFAULT_TOOLS_PATH = "app/data/tools.js";
const VALID_CATEGORIES = new Set(["artisans_tools", "gaming_set", "musical_instrument", "kit", "specialist_tool"]);

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${id}: ${pathName} must be a non-empty string`);
}

function validateToolRecord(errors, tool, key) {
  const id = tool?.id || key || "<unknown>";
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
    errors.push(`${key}: tool must be an object`);
    return;
  }
  validateString(errors, id, "id", tool.id);
  if (tool.id !== key) errors.push(`${id}: key must match id`);
  validateString(errors, id, "name", tool.name);
  validateString(errors, id, "category", tool.category);
  if (!VALID_CATEGORIES.has(tool.category)) errors.push(`${id}: unknown category "${tool.category}"`);
  if (!Array.isArray(tool.tags)) errors.push(`${id}: tags must be an array`);
}

export async function validateTools(toolsPath = DEFAULT_TOOLS_PATH) {
  const errors = [];
  const mod = await import(new URL(`../${toolsPath}`, import.meta.url));
  const tools = mod.TOOLS;
  const pools = mod.TOOL_POOLS;
  if (!tools || typeof tools !== "object" || Array.isArray(tools)) return ["TOOLS export must be an object registry"];
  if (!pools || typeof pools !== "object" || Array.isArray(pools)) return ["TOOL_POOLS export must be an object"];

  for (const [key, tool] of Object.entries(tools)) validateToolRecord(errors, tool, key);
  const validToolIds = new Set(Object.keys(tools));
  for (const [poolId, toolIds] of Object.entries(pools)) {
    if (!Array.isArray(toolIds)) {
      errors.push(`${poolId}: tool pool must be an array`);
      continue;
    }
    for (const toolId of toolIds) {
      if (!validToolIds.has(toolId)) errors.push(`${poolId}: unknown tool id "${toolId}"`);
    }
  }

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = await validateTools(process.argv[2] || DEFAULT_TOOLS_PATH);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[tools] Validation OK");
  }
}
