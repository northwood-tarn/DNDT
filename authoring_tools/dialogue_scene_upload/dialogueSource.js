export const REQUIRED_HEADER_FIELDS = [
  "format.version", "act", "scene.id", "scene.title", "dialogue.type", "location.id",
  "trigger.id", "participants",
  "frequency", "required.flags", "forbidden.flags", "start.effects",
  "bypass.effects", "completion.effects", "success.destination", "failure.destination"
];

export const LIST_FIELDS = new Set([
  "participants", "required.flags", "forbidden.flags", "start.effects",
  "bypass.effects", "completion.effects"
]);

export const CANONICAL_EFFECTS = [
  "set.flag", "clear.flag", "start.combat", "give.item", "remove.item",
  "change.gold", "go.scene", "go.map", "check.skill", "open.service"
];
export const ACTS = ["1_Greyharbour", "2_Necropolis", "3_Backlands"];

const ID_PATTERN = /^[a-z]+:[a-z0-9]+(?:\.[a-z0-9]+)*$/;
const OPTION_PATTERN = /^(o[a-z]+)\.\s+(.+)$/;
const ANNOTATION_PATTERN = /\/\/([^/]+)\/\//g;

function valueOf(raw) {
  const value = raw.trim();
  if (value === "null") return null;
  if (value === "[]") return [];
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function parseDialogueSource(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const errors = [];
  if (lines[0]?.trim() !== "---") {
    return { header: {}, body: normalized, options: [], annotations: [], errors: ["The file must begin with ---."], warnings: [] };
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) {
    return { header: {}, body: "", options: [], annotations: [], errors: ["The mandatory header has no closing ---."], warnings: [] };
  }

  const header = {};
  let activeList = null;
  for (const rawLine of lines.slice(1, end)) {
    const listMatch = rawLine.match(/^\s+-\s+(.+)$/);
    if (listMatch && activeList) {
      header[activeList].push(valueOf(listMatch[1]));
      continue;
    }
    const fieldMatch = rawLine.match(/^([a-z]+(?:\.[a-z]+)*):\s*(.*)$/);
    if (!fieldMatch) {
      if (rawLine.trim()) errors.push(`Invalid header line: ${rawLine.trim()}`);
      continue;
    }
    const [, key, rawValue] = fieldMatch;
    header[key] = LIST_FIELDS.has(key) && rawValue.trim() === "" ? [] : valueOf(rawValue);
    activeList = LIST_FIELDS.has(key) && Array.isArray(header[key]) ? key : null;
  }

  const body = lines.slice(end + 1).join("\n").trim();
  const annotations = [];
  const options = [];
  body.split("\n").forEach((line, lineIndex) => {
    const match = line.match(OPTION_PATTERN);
    if (!match) return;
    const [, label, optionSource] = match;
    const optionAnnotations = [];
    for (const annotationMatch of optionSource.matchAll(ANNOTATION_PATTERN)) {
      const text = annotationMatch[1].trim();
      const canonical = text.match(/^([a-z]+(?:\.[a-z]+)*)=(.+)$/);
      const annotation = {
        id: `annotation.${annotations.length + 1}`,
        text,
        option: label,
        line: lineIndex + end + 2,
        effect: canonical?.[1] || null,
        argument: canonical?.[2]?.trim() || null,
        resolved: Boolean(canonical)
      };
      annotations.push(annotation);
      optionAnnotations.push(annotation.id);
    }
    options.push({
      label,
      text: optionSource.replace(ANNOTATION_PATTERN, "").trim(),
      annotations: optionAnnotations
    });
  });

  return { header, body, options, annotations, errors, warnings: [] };
}

function idsIn(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item) => typeof item === "string").flatMap((item) => item.match(/[a-z]+:[a-z0-9]+(?:\.[a-z0-9]+)*/g) || []);
}

export function validateDialogue(parsed, { header = parsed.header, resolutions = {}, catalogue = [] } = {}) {
  const errors = [...parsed.errors];
  const warnings = [];
  const known = new Set(catalogue.map((entry) => entry.id));

  REQUIRED_HEADER_FIELDS.forEach((field) => {
    if (!(field in header)) errors.push(`Missing required header field: ${field}`);
  });
  LIST_FIELDS.forEach((field) => {
    if (field in header && !Array.isArray(header[field])) errors.push(`${field} must be a list.`);
  });
  if (header["format.version"] !== 1) errors.push("format.version must be 1.");
  if (!ACTS.includes(header.act)) errors.push("act must be 1_Greyharbour, 2_Necropolis, or 3_Backlands.");
  if (!["full", "vignette", "emberside"].includes(header["dialogue.type"])) errors.push("dialogue.type must be full, vignette, or emberside.");
  if (!["once", "repeat"].includes(header.frequency)) errors.push("frequency must be once or repeat.");

  Object.entries(header).forEach(([field, value]) => {
    idsIn(value).forEach((id) => {
      if (id.startsWith("nid:")) errors.push(`Resolve placeholder ${id} in ${field}.`);
      else if (!ID_PATTERN.test(id)) errors.push(`Invalid canonical ID ${id} in ${field}.`);
      else if (field === "scene.id") return;
      else if (!known.has(id) && field === "participants") errors.push(`Create narrative participant ${id} with a display name.`);
      else if (!known.has(id)) errors.push(`Catalogue does not contain ${id}.`);
    });
  });

  const required = new Set(header["required.flags"] || []);
  (header["forbidden.flags"] || []).forEach((flag) => {
    if (required.has(flag)) errors.push(`${flag} is both required and forbidden.`);
  });

  const resolvedAnnotations = parsed.annotations.map((annotation) => ({ ...annotation, ...(resolutions[annotation.id] || {}) }));
  resolvedAnnotations.forEach((annotation) => {
    if (!annotation.effect || !annotation.argument) errors.push(`Resolve //${annotation.text}// on option ${annotation.option}.`);
    else if (!CANONICAL_EFFECTS.includes(annotation.effect)) errors.push(`Unknown effect ${annotation.effect}.`);
    if (annotation.argument?.includes("nid:")) errors.push(`Resolve placeholder ${annotation.argument}.`);
    idsIn(annotation.argument).forEach((id) => {
      if (!id.startsWith("nid:") && !known.has(id)) errors.push(`Catalogue does not contain ${id}.`);
    });
  });

  const type = header["dialogue.type"];
  const hasHeaderMechanics = ["required.flags", "forbidden.flags", "start.effects", "bypass.effects", "completion.effects"]
    .some((field) => (header[field] || []).length) || header["success.destination"] || header["failure.destination"];
  if (type === "vignette" && (parsed.options.length || resolvedAnnotations.length || hasHeaderMechanics)) {
    errors.push("Vignettes cannot contain options, effects, requirements, encounters, or destinations.");
  }
  if (type === "emberside") {
    const forbidden = resolvedAnnotations.filter((item) => item.effect && !["set.flag", "clear.flag", "go.scene"].includes(item.effect));
    if (forbidden.length) errors.push("Emberside dialogue permits only set.flag, clear.flag, and go.scene effects.");
    if (header["location.id"] && !String(header["location.id"]).includes("ember")) warnings.push("Confirm that this emberside location is an ember.");
  }
  if (header.frequency === "once" && !(header["completion.effects"] || []).length && !header["success.destination"] && !header["failure.destination"] && !resolvedAnnotations.length) {
    warnings.push("Once-only scene has no persistent outcome or destination.");
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], annotations: resolvedAnnotations };
}

export function compileDialogue(parsed, options = {}) {
  const header = options.header || parsed.header;
  const validation = validateDialogue(parsed, { ...options, header });
  if (validation.errors.length) return { package: null, validation };
  const sceneCatalogueEntry = { id: header["scene.id"], kind: "scene", label: header["scene.title"], aliases: [], status: "active", source: header["scene.id"] };
  const catalogueAdditions = [sceneCatalogueEntry, ...(options.catalogueAdditions || [])].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index);
  return {
    package: {
      formatVersion: header["format.version"],
      scene: {
        id: header["scene.id"], act: header.act, title: header["scene.title"], type: header["dialogue.type"],
        locationId: header["location.id"], triggerId: header["trigger.id"], participants: header.participants,
        frequency: header.frequency,
        requirements: { requiredFlags: header["required.flags"], forbiddenFlags: header["forbidden.flags"] },
        effects: { start: header["start.effects"], bypass: header["bypass.effects"], completion: header["completion.effects"] },
        destinations: { success: header["success.destination"], failure: header["failure.destination"] }
      },
      content: { body: parsed.body, options: parsed.options.map((option) => ({ ...option, effects: validation.annotations.filter((a) => option.annotations.includes(a.id)).map(({ effect, argument }) => ({ effect, argument })) })) },
      catalogueAdditions
    },
    validation
  };
}

export function isCanonicalId(value) { return ID_PATTERN.test(value) && !value.startsWith("nid:"); }
