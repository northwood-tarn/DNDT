// Canonical top-layer campaign geography.
// This stores the campaign map hierarchy, not the final painted map.

export const WORLD_MAP = {
  id: "campaign_world_topology_v1",
  name: "Campaign Topology",
  schemaVersion: 1,
  description:
    "Three act-scale areas arranged as increasingly open radiants. Each area supports ember-to-ember travel, locations, and attached grid exploration maps where needed.",
  mapPrinciples: [
    "The campaign map has three main areas.",
    "Each area contains numbered locations.",
    "Travel inside an area is between embers.",
    "Some locations attach to local grid exploration maps.",
    "The top-layer map should read as three increasingly general radiants of vast openness.",
  ],
  actAreas: [
    {
      id: "greyharbour",
      code: "01",
      slug: "greyharbour",
      name: "Greyharbour",
      act: 1,
      visualRole: "first radiant; narrow coastal/promontory constraint",
      summary:
        "The opening act area: a broad promontory cut by a 100ft escarpment, holding Greyharbour and The Refinery, with No Man's Land between it and the Necropolis.",
      travelModel: "ember_travel_within_act_area",
      subareas: [
        {
          id: "greyharbour",
          code: "01.01",
          slug: "greyharbour.greyharbour",
          name: "Greyharbour",
          aliases: ["Harbour"],
          role: "settlement_gate",
          placement:
            "On the end of the broad promontory, controlling access to the refinery.",
          borders: ["the_refinery", "no_mans_land"],
          travelNotes:
            "The only practical route to The Refinery passes through Greyharbour.",
          attachedExplorationMaps: [],
        },
        {
          id: "the_refinery",
          code: "01.02",
          slug: "greyharbour.refinery",
          name: "The Refinery",
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
          code: "01.03",
          slug: "greyharbour.no-mans-land",
          name: "No Man's Land",
          role: "conflict_exhausted_band",
          placement:
            "A band of exhausted ground between Greyharbour and the Necropolis.",
          borders: ["greyharbour", "the_walls"],
          travelNotes:
            "Acts as the transition pressure between Act I and the Necropolis.",
          attachedExplorationMaps: [],
        },
      ],
    },
    {
      id: "necropolis",
      code: "02",
      slug: "necropolis",
      name: "Necropolis",
      act: 2,
      visualRole: "second radiant; walled city occupying the central span",
      summary:
        "The death-city beyond No Man's Land: a full-width walled area organized by edge bands, a small cultural bazaar, a long regnant spine, and an administrative mass.",
      travelModel: "ember_travel_within_act_area",
      subareas: [
        {
          id: "the_walls",
          code: "02.01",
          slug: "necropolis.walls",
          name: "The Walls",
          role: "front_city_band",
          placement:
            "Lines the edge of No Man's Land inside the city and stretches across the whole map width.",
          borders: ["no_mans_land", "twilight_bazaar", "chalk_residences", "regnant_eternal", "administrative_enclave"],
          travelNotes:
            "Entry-facing band and first Necropolis layer.",
          attachedExplorationMaps: [],
        },
        {
          id: "twilight_bazaar",
          code: "02.02",
          slug: "necropolis.twilight-bazaar",
          name: "The Twilight Bazaar",
          role: "cultural_center",
          placement:
            "At the top of the city, consuming roughly 15% of the space.",
          borders: ["the_walls", "administrative_enclave"],
          travelNotes:
            "The center of what passes for cultural life in the city.",
          attachedExplorationMaps: [],
        },
        {
          id: "chalk_residences",
          code: "02.03",
          slug: "necropolis.chalk-residences",
          name: "The Chalk Residences",
          role: "residential_quarter",
          placement:
            "A distinct Necropolis subsection of pale domestic massing and civic housing.",
          borders: ["the_walls", "regnant_eternal", "administrative_enclave"],
          travelNotes:
            "Residential pressure between the entry band, authority spine, and administrative rear edge.",
          attachedExplorationMaps: [],
        },
        {
          id: "administrative_enclave",
          code: "02.04",
          slug: "necropolis.administrative-enclave",
          name: "The Administrative Enclave",
          role: "rear_city_band",
          placement:
            "A large portion of the city running along the opposite full edge.",
          borders: ["twilight_bazaar", "regnant_eternal", "endless_plain"],
          travelNotes:
            "The back edge of the Necropolis before The Endless Plains.",
          attachedExplorationMaps: [],
        },
        {
          id: "regnant_eternal",
          code: "02.05",
          slug: "necropolis.regnant-eternal",
          name: "The Regnant Eternal",
          role: "authority_spine",
          placement:
            "A long, thin set of buildings culminating in the Black Apex Throne.",
          borders: ["the_walls", "administrative_enclave"],
          travelNotes:
            "The Black Apex Throne absorbs about the same space as the bazaar at the opposite side of the city.",
          attachedExplorationMaps: [],
        },
      ],
    },
    {
      id: "endless_plains",
      code: "03",
      slug: "endless-plains",
      name: "The Endless Plains",
      act: 3,
      visualRole: "third radiant; vast openness beyond the city",
      summary:
        "The broad final act area outside the Necropolis: an open plain, grave cluster, Carrow bloom, the bridge to the Escarpment of Eyes, and the route towards the Portal.",
      travelModel: "ember_travel_within_act_area",
      subareas: [
        {
          id: "endless_plain",
          code: "03.01",
          slug: "endless-plains.endless-plain",
          name: "The Endless Plain",
          role: "wide_frontier_band",
          placement:
            "Runs along the whole wall of the Necropolis in a wide band.",
          borders: ["administrative_enclave", "untended_graves", "carrow"],
          travelNotes:
            "The main Endless Plains entry field.",
          attachedExplorationMaps: [],
        },
        {
          id: "untended_graves",
          code: "03.02",
          slug: "endless-plains.untended-graves",
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
          code: "03.03",
          slug: "endless-plains.carrow",
          name: "Carrow",
          role: "southern_bloom",
          placement:
            "Starts as a small slip along the bottom side of The Endless Plains, then blooms outward like a clumsy triangle.",
          borders: ["endless_plain"],
          travelNotes:
            "A widening southern growth from the Endless Plains edge.",
          attachedExplorationMaps: [],
        },
        {
          id: "escarpment_of_eyes",
          code: "03.04",
          slug: "endless-plains.escarpment-of-eyes",
          name: "The Escarpment of Eyes",
          role: "far_bridge_destination",
          placement:
            "Reached by a massive bridge from the center/farthest point of the Plain.",
          borders: ["endless_plain", "towards_the_portal"],
          travelNotes:
            "Do not overdraw yet; bridge relationship matters first.",
          attachedExplorationMaps: [],
        },
        {
          id: "towards_the_portal",
          code: "03.05",
          slug: "endless-plains.towards-the-portal",
          name: "Towards the Portal",
          role: "endgame_approach",
          placement:
            "Final endgame approach beyond/near the Escarpment of Eyes.",
          borders: ["escarpment_of_eyes"],
          travelNotes:
            "Route toward the end-game location.",
          attachedExplorationMaps: [],
        },
      ],
    },
  ],
};

export default WORLD_MAP;
