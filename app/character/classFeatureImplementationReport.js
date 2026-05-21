import { CLASSES } from "../data/classes.js";
import { isDeclarativeFeatureImplemented } from "./featureImplementation.js";

export function createClassFeatureImplementationReport(classRegistry = CLASSES) {
  const classes = [];
  for (const classRecord of Object.values(classRegistry)) {
    classes.push(createClassReport(classRecord));
  }
  const totals = classes.reduce((out, item) => ({
    total: out.total + item.totals.total,
    implemented: out.implemented + item.totals.implemented,
    unimplemented: out.unimplemented + item.totals.unimplemented,
  }), { total: 0, implemented: 0, unimplemented: 0 });

  return {
    totals,
    classes,
    unimplementedByClass: Object.fromEntries(classes.map((item) => [
      item.classId,
      item.unimplemented,
    ])),
  };
}

function createClassReport(classRecord) {
  const sections = [
    sectionReport("class", classRecord.id, classRecord.name, classRecord.features),
    ...Object.entries(classRecord.subclasses || {}).map(([name, subclass]) =>
      sectionReport("subclass", subclass.id, name, subclass.features)
    ),
    ...Object.entries(classRecord.pacts || {}).map(([name, pact]) =>
      sectionReport("pact", pact.id, name, pact.features)
    ),
  ];
  const features = sections.flatMap((section) => section.features);
  const unimplemented = features.filter((feature) => feature.implemented === false);

  return {
    classId: classRecord.id,
    className: classRecord.name,
    totals: {
      total: features.length,
      implemented: features.filter((feature) => feature.implemented).length,
      unimplemented: unimplemented.length,
    },
    sections,
    unimplemented: groupByLevel(unimplemented),
  };
}

function sectionReport(kind, ownerId, ownerName, featuresByLevel = {}) {
  const features = [];
  for (const [levelText, levelFeatures] of Object.entries(featuresByLevel || {})) {
    const level = Number(levelText);
    for (const feature of levelFeatures || []) {
      const implemented = isDeclarativeFeatureImplemented(feature);
      features.push({
        id: `${kind}:${ownerId}:${slug(feature.name)}`,
        name: feature.name,
        level,
        ownerKind: kind,
        ownerId,
        ownerName,
        type: feature.type,
        implemented,
        uses: feature.uses || null,
        description: feature.description || feature.note || "",
      });
    }
  }
  return {
    kind,
    ownerId,
    ownerName,
    features,
    unimplemented: groupByLevel(features.filter((feature) => feature.implemented === false)),
  };
}

function groupByLevel(features) {
  return features.reduce((out, feature) => {
    const key = String(feature.level);
    if (!out[key]) out[key] = [];
    out[key].push(feature);
    return out;
  }, {});
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
