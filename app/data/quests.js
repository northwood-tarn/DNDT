export const GREYHARBOUR_CURRENT_LEADER = Object.freeze({
  id: "orion",
  name: "Orion",
  role: "Leader of Grey Harbour",
  age: "In her sixties",
  appearance: "A hefty former fisherwoman with short grey hair and a scar crossing her forehead and cutting into her hairline.",
  publicDisposition: "Calm, stoic, capable, and still occupied with the practical work of leading Grey Harbour.",
  privateTruth: "She is profoundly anxious for Grey Harbour and has been privately broken by the collapse of the Outer Harbour.",
  motive: "She deeply loves Grey Harbour and is now stoically organising for its death while continuing to lead it.",
});

export const GREYHARBOUR_QUESTS = Object.freeze([
  Object.freeze({
    id: "quest:greyharbour.illuminated.manuscript",
    title: "An Illuminated Manuscript",
    journalOrder: 1,
    giver: "Orion",
    location: "Library of the Deep",
    summary: "Proceed to the Library of the Deep and investigate the disappearance of its main arcane scholar, Twombly.",
    briefing: "Twombly has been missing for a couple of days. Before disappearing, he reported finding something that might be useful.",
    offer: "Orion believes someone of your “broader skill set” may be able to make progress.",
    objectives: Object.freeze([
      Object.freeze({
        id: "objective:greyharbour.illuminated.manuscript.library",
        text: "Proceed to the Library of the Deep and investigate Twombly’s disappearance and reported discovery.",
        initialStatus: "active",
      }),
    ]),
  }),
  Object.freeze({
    id: "quest:greyharbour.oil.and.water",
    title: "Oil and Water",
    journalOrder: 2,
    giver: "Orion",
    location: "The oil refinery",
    summary: "Go to the refinery and investigate reports that its Lanterna oil has become contaminated.",
    briefing: "The refinery turns certain oily fish into Lanterna oil. Rumours now say that the oil has become contaminated.",
    offer: "Orion believes someone of your “broader skill set” may be able to make progress.",
    objectives: Object.freeze([
      Object.freeze({
        id: "objective:greyharbour.oil.and.water.refinery",
        text: "Investigate the reported contamination at the Lanterna-oil refinery.",
        initialStatus: "active",
      }),
    ]),
  }),
]);

export function getGreyharbourQuests() {
  return GREYHARBOUR_QUESTS.map((quest) => structuredClone(quest)).sort((left, right) => left.journalOrder - right.journalOrder);
}
