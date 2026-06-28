// app/data/spells/level7.js
// Choice-list records for level-up validation. Add combat hooks as implementation catches up.

const level7Spell = (id, name, school, classes, text, tags = []) => ({
  id, name, level: 7, school,
  casting: { time: 1, unit: "action", reactionTrigger: null },
  components: { v: true, s: true, m: false, material: null, consume: false, costGp: 0 },
  concentration: false,
  ritual: false,
  duration: { type: "instant", value: 0, unit: "rounds", special: null },
  range: { type: "distance", distance: 60, unit: "ft", special: null },
  target: { type: "creature", count: 1, friendly: false, requiresSight: true },
  area: { shape: "none", size: 0, length: 0, width: 0, height: 0, unit: "ft" },
  scaling: { type: "none", slot: { text: null }, cantrip: { tiers: [] } },
  classes,
  minCasterLevel: null,
  featureGate: null,
  hiddenUntilUnlocked: false,
  source: "PHB",
  tags,
  text,
  dialogueRelated: false,
  hooks: {}
});

export const SPELLS_LEVEL_7 = {
  "conjure_celestial": level7Spell("conjure_celestial", "Conjure Celestial", "Conjuration", ["Cleric"], "Call a celestial spirit to aid you.", ["summoning","concentration"]),
  "delayed_blast_fireball": level7Spell("delayed_blast_fireball", "Delayed Blast Fireball", "Evocation", ["Wizard"], "Create a growing bead of fire that detonates later.", ["damage","fire","area","concentration"]),
  "divine_word": level7Spell("divine_word", "Divine Word", "Evocation", ["Cleric"], "Utter a divine word that overwhelms weakened enemies.", ["radiant","control"]),
  "etherealness": level7Spell("etherealness", "Etherealness", "Conjuration", ["Cleric","Warlock","Wizard"], "Step into the border of the Ethereal Plane.", ["travel","utility"]),
  "finger_of_death": level7Spell("finger_of_death", "Finger of Death", "Necromancy", ["Warlock","Wizard"], "Assault a creature with lethal necrotic energy.", ["damage","necrotic"]),
  "fire_storm": level7Spell("fire_storm", "Fire Storm", "Evocation", ["Cleric"], "Sheets of divine flame roar through an area.", ["damage","fire","area"]),
  "forcecage": level7Spell("forcecage", "Forcecage", "Evocation", ["Warlock","Wizard"], "Trap a creature in a prison of magical force.", ["control","force"]),
  "mirage_arcane": level7Spell("mirage_arcane", "Mirage Arcane", "Illusion", ["Wizard"], "Make terrain look, sound, and feel like another kind of terrain.", ["illusion","terrain"]),
  "plane_shift": level7Spell("plane_shift", "Plane Shift", "Conjuration", ["Cleric","Warlock","Wizard"], "Transport creatures to another plane.", ["teleport","travel"]),
  "power_word_pain": level7Spell("power_word_pain", "Power Word Pain", "Enchantment", ["Warlock","Wizard"], "Overwhelm a creature with crippling pain.", ["control"]),
  "project_image": level7Spell("project_image", "Project Image", "Illusion", ["Wizard"], "Create an illusory double of yourself at a distance.", ["illusion","utility"]),
  "regenerate": level7Spell("regenerate", "Regenerate", "Transmutation", ["Cleric"], "Stimulate a creature's healing and restore lost body parts.", ["healing"]),
  "resurrection": level7Spell("resurrection", "Resurrection", "Necromancy", ["Cleric"], "Return a dead creature to life.", ["healing","revival"]),
  "reverse_gravity": level7Spell("reverse_gravity", "Reverse Gravity", "Transmutation", ["Wizard"], "Reverse gravity in an area.", ["control","area","concentration"]),
  "sequester": level7Spell("sequester", "Sequester", "Transmutation", ["Wizard"], "Hide a willing creature or object from detection.", ["ward","utility"]),
  "symbol": level7Spell("symbol", "Symbol", "Abjuration", ["Cleric","Wizard"], "Inscribe a magical glyph that triggers a chosen effect.", ["ward","trap"]),
};

export default SPELLS_LEVEL_7;
