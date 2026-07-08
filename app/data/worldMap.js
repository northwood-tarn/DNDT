// Canonical top-layer campaign geography.
// This stores the campaign map hierarchy, not the final painted map.

export const WORLD_MAP = {
  id: "campaign_world_topology_v1",
  name: "Campaign Topology",
  schemaVersion: 1,
  description:
    "Three act-scale areas arranged as increasingly open radiants. Each act area supports ember-to-ember travel, subareas, and attached grid exploration maps where needed.",
  mapPrinciples: [
    "The campaign map has three main act areas.",
    "Each act area contains subareas.",
    "Travel inside an act area is between embers.",
    "Some subareas attach to local grid exploration maps.",
    "The top-layer map should read as three increasingly general radiants of vast openness.",
  ],
  actAreas: [
    {
      id: "greyharbour_act",
      name: "Greyharbour",
      act: 1,
      visualRole: "first radiant; narrow coastal/promontory constraint",
      summary:
        "The opening act area: a broad promontory cut by a 100ft escarpment, holding Greyharbour and the Oil Refinery, with No-Man's Land between it and the Necropolis.",
      travelModel: "ember_travel_within_act_area",
      subareas: [
        {
          id: "greyharbour",
          name: "Greyharbour",
          aliases: ["Harbour"],
          role: "settlement_gate",
          placement:
            "On the end of the broad promontory, controlling access to the refinery.",
          borders: ["oil_refinery", "no_mans_land"],
          travelNotes:
            "The only practical route to the Oil Refinery passes through Greyharbour.",
          attachedExplorationMaps: [],
        },
        {
          id: "oil_refinery",
          name: "Oil Refinery",
          role: "industrial_branch",
          placement:
            "Also on the promontory end, beyond Greyharbour and constrained by the escarpment.",
          borders: ["greyharbour"],
          travelNotes:
            "Requires passage through Greyharbour.",
          attachedExplorationMaps: [],
        },
        {
          id: "no_mans_land",
          name: "No-Man's Land",
          role: "conflict_exhausted_band",
          placement:
            "A band of exhausted ground between Greyharbour and the Necropolis.",
          borders: ["greyharbour", "inside_the_walls"],
          travelNotes:
            "Acts as the transition pressure between Act I and the Necropolis.",
          attachedExplorationMaps: [],
        },
      ],
    },
    {
      id: "necropolis_act",
      name: "The Necropolis",
      act: 2,
      visualRole: "second radiant; walled city occupying the central span",
      summary:
        "The death-city beyond No-Man's Land: a full-width walled area organized by edge bands, a small cultural bazaar, a long regnant spine, and an administrative mass.",
      travelModel: "ember_travel_within_act_area",
      subareas: [
        {
          id: "inside_the_walls",
          name: "Inside the Walls",
          role: "front_city_band",
          placement:
            "Lines the edge of No-Man's Land inside the city and stretches across the whole map width.",
          borders: ["no_mans_land", "twilight_bazaar", "regnant_eternal", "administrative_encasement"],
          travelNotes:
            "Entry-facing band and first Necropolis layer.",
          attachedExplorationMaps: [],
        },
        {
          id: "twilight_bazaar",
          name: "The Twilight Bazaar",
          role: "cultural_center",
          placement:
            "At the top of the city, consuming roughly 15% of the space.",
          borders: ["inside_the_walls", "administrative_encasement"],
          travelNotes:
            "The center of what passes for cultural life in the city.",
          attachedExplorationMaps: [],
        },
        {
          id: "regnant_eternal",
          name: "The Regnant Eternal",
          role: "authority_spine",
          placement:
            "A long, thin set of buildings culminating in the Black Apex Throne.",
          borders: ["inside_the_walls", "administrative_encasement"],
          travelNotes:
            "The Black Apex Throne absorbs about the same space as the bazaar at the opposite side of the city.",
          attachedExplorationMaps: [],
        },
        {
          id: "administrative_encasement",
          name: "The Administrative Encasement",
          role: "rear_city_band",
          placement:
            "A large portion of the city running along the opposite full edge.",
          borders: ["twilight_bazaar", "regnant_eternal", "endless_plain"],
          travelNotes:
            "The back edge of the Necropolis before the Backlands.",
          attachedExplorationMaps: [],
        },
      ],
    },
    {
      id: "backlands_act",
      name: "The Backlands",
      act: 3,
      visualRole: "third radiant; vast openness beyond the city",
      summary:
        "The broad final act area outside the Necropolis: an open plain, grave cluster, Carrow bloom, the bridge to the Escarpment of Eyes, and the Portal.",
      travelModel: "ember_travel_within_act_area",
      subareas: [
        {
          id: "endless_plain",
          name: "The Endless Plain",
          role: "wide_frontier_band",
          placement:
            "Runs along the whole wall of the Necropolis in a wide band.",
          borders: ["administrative_encasement", "untended_graves", "carrow"],
          travelNotes:
            "The main Backlands entry field.",
          attachedExplorationMaps: [],
        },
        {
          id: "untended_graves",
          name: "Untended Graves",
          role: "northern_cluster",
          placement:
            "A clustered space partially punctuating the Endless Plain to the north/top.",
          borders: ["endless_plain"],
          travelNotes:
            "A northern cluster within the plain.",
          attachedExplorationMaps: [],
        },
        {
          id: "carrow",
          name: "Carrow",
          role: "southern_bloom",
          placement:
            "Starts as a small slip along the bottom side of the Backlands, then blooms outward like a clumsy triangle.",
          borders: ["endless_plain"],
          travelNotes:
            "A widening southern growth from the Backlands edge.",
          attachedExplorationMaps: [],
        },
        {
          id: "escarpment_of_eyes",
          name: "The Escarpment of Eyes",
          role: "far_bridge_destination",
          placement:
            "Reached by a massive bridge from the center/farthest point of the Plain.",
          borders: ["endless_plain", "portal"],
          travelNotes:
            "Do not overdraw yet; bridge relationship matters first.",
          attachedExplorationMaps: [],
        },
        {
          id: "portal",
          name: "The Portal",
          role: "endgame_area",
          placement:
            "Final endgame area beyond/near the Escarpment of Eyes.",
          borders: ["escarpment_of_eyes"],
          travelNotes:
            "End-game location.",
          attachedExplorationMaps: [],
        },
      ],
    },
  ],
};

export default WORLD_MAP;
