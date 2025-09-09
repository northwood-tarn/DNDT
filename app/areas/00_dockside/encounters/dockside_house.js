// app/areas/00_dockside/encounters/dockside_house.js
// Data-driven Intern spawn; initial distances for starting foes.

const encounter = {
  id: 'dockside_house',
  title: 'House Ambush',
  returnAreaId: '00_dockside',
  participants: [
    { role: 'pc', ref: 'player' },
    // Start adjacent to PC (melee range):
    { role: 'npc', enemyId: 'goblin_a', enemyKey: 'goblin', distanceFromPC: 5 },
    { role: 'npc', enemyId: 'goblin_b', enemyKey: 'goblin', distanceFromPC: 5 },
  ],
  triggers: [
    {
      type: 'spawn',
      at: 'roundStart',
      round: 2,
      announceAtEndOfPrev: true,
      announceText: 'You hear hurried steps on the stair—someone is rushing in!',
      actor: {
        role: 'npc',
        enemyId: 'goblin_intern',
        enemyKey: 'goblin_intern',
        distanceFromPC: 30
      }
    }
  ]
};

export default encounter;
