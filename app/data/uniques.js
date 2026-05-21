// app/data/uniques.js
// Unique, non-repeatable narrative items. These are not combat actions.

export const uniques = [
  {
    id: "gold_earring",
    name: "Gold Earring",
    type: "unique",
    category: "narrative",
    unique: true,
    uses: "infinite",
    useTime: "dialogue",
    consumeOnUse: false,
    stackable: false,
    combat: {
      usable: false
    },
    narrative: {
      contexts: ["dialogue", "exploration"],
      tags: ["clue", "dockside", "personal_item"],
      inspectText: "A small gold hoop, dulled by salt air and dockside grime.",
      dialogueKeys: ["gold_earring"]
    },
    value: 25,
    description: "A small gold hoop, dulled by salt air and dockside grime."
  }
];

const _uniquesById = new Map(uniques.map(item => [item.id, item]));

export function getUniqueById(id) {
  if (!id) return null;
  return _uniquesById.get(id) || null;
}
