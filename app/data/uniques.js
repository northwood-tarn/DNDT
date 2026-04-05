// app/data/uniques.js
// Unique, non-repeatable items.

export const uniques = [
  {
    name: "Gold Earring",
    type: "unique",
    id: "gold_earring",
    uses: "infinite",
    useTime: "exploration",
    value: 25,
    consumeOnUse: false,
    description: "A small gold hoop, dulled by salt air and dockside grime."
  }
];

export function getUniqueById(id) {
  return uniques.find(u => u.id === id) || null;
}