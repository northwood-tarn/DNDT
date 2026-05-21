import { CLASSES } from "../data/classes.js";
import { listFeats } from "../data/feats.js";
import { SPECIES } from "../data/species.js";
import { isDeclarativeFeatureImplemented } from "./featureImplementation.js";

export function createCharacterFeatureImplementationReport(registries = {}) {
  const entries = [
    ...classEntries(registries.classes || CLASSES),
    ...speciesEntries(registries.species || SPECIES),
    ...featEntries(registries.feats || listFeats()),
  ];
  const unimplemented = entries.filter((entry) => entry.implemented === false);

  return {
    totals: {
      total: entries.length,
      implemented: entries.length - unimplemented.length,
      unimplemented: unimplemented.length,
    },
    entries,
    unimplementedBySource: groupBy(unimplemented, (entry) => entry.source),
    unimplementedByOwner: groupBy(unimplemented, (entry) => entry.ownerId),
  };
}

function classEntries(classRegistry) {
  return Object.values(classRegistry).flatMap((classRecord) => [
    ...featureEntries({
      source: "class",
      ownerId: classRecord.id,
      ownerName: classRecord.name,
      featuresByLevel: classRecord.features,
    }),
    ...Object.values(classRecord.subclasses || {}).flatMap((subclass) => featureEntries({
      source: "subclass",
      ownerId: `${classRecord.id}:${subclass.id}`,
      ownerName: `${classRecord.name}: ${subclass.id}`,
      featuresByLevel: subclass.features,
    })),
    ...Object.values(classRecord.pacts || {}).flatMap((pact) => featureEntries({
      source: "pact",
      ownerId: `${classRecord.id}:${pact.id}`,
      ownerName: `${classRecord.name}: ${pact.id}`,
      featuresByLevel: pact.features,
    })),
  ]);
}

function speciesEntries(speciesRegistry) {
  return Object.values(speciesRegistry).flatMap((species) => [
    ...flatFeatureEntries({
      source: "species",
      ownerId: species.id,
      ownerName: species.name,
      features: species.features,
    }),
    ...Object.values(species.lineages || {}).flatMap((lineage) => flatFeatureEntries({
      source: "lineage",
      ownerId: `${species.id}:${lineage.id}`,
      ownerName: `${species.name}: ${lineage.name}`,
      features: lineage.features,
    })),
  ]);
}

function featEntries(feats) {
  return Object.values(feats).map((feat) => entry({
    source: feat.type || "feat",
    ownerId: feat.id,
    ownerName: feat.name,
    level: feat.minLevel || 1,
    feature: feat,
  }));
}

function featureEntries({ source, ownerId, ownerName, featuresByLevel = {} }) {
  return Object.entries(featuresByLevel || {}).flatMap(([levelText, features]) =>
    (features || []).map((feature) => entry({
      source,
      ownerId,
      ownerName,
      level: Number(levelText),
      feature,
    }))
  );
}

function flatFeatureEntries({ source, ownerId, ownerName, features = [] }) {
  return (features || []).map((feature) => entry({
    source,
    ownerId,
    ownerName,
    level: feature.minLevel || 1,
    feature,
  }));
}

function entry({ source, ownerId, ownerName, level, feature }) {
  return {
    id: `${source}:${ownerId}:${slug(feature.id || feature.name)}`,
    source,
    ownerId,
    ownerName,
    featureId: feature.id || slug(feature.name),
    name: feature.name,
    level,
    implemented: isDeclarativeFeatureImplemented(feature),
    description: feature.description || feature.note || "",
  };
}

function groupBy(values, keyFn) {
  return values.reduce((out, value) => {
    const key = keyFn(value);
    out[key] ??= [];
    out[key].push(value);
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
