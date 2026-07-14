import { beginTraversal, getAvailableRoutes, traverseRoute, validateTraversalMap } from "../exploration/grandTraversal.js";

export default class GrandExplorationScene {
  start(params = {}) {
    this.params = params;
    this.map = params.map;
    const errors = validateTraversalMap(this.map);
    if (errors.length) throw new Error(`Invalid traversal map: ${errors.join("; ")}`);
    this.saveGame = params.saveGame;
    const current = this.saveGame?.world?.traversal?.[this.map.id]?.nodeId;
    if (!current) this.saveGame = beginTraversal(this.saveGame, this.map, params.startNodeId || this.map.nodes[0]?.id);
    this.persist();
    this.render();
  }

  render() {
    this.cleanup();
    const state = this.saveGame.world.traversal[this.map.id];
    const node = this.map.nodes.find((item) => item.id === state.nodeId);
    const root = document.createElement("section");
    root.className = "grand-exploration";
    root.setAttribute("aria-label", this.map.title || "Travel map");
    const heading = document.createElement("h1");
    heading.textContent = node?.label || node?.title || node?.id || this.map.title;
    root.append(heading);
    if (node?.description) {
      const description = document.createElement("p");
      description.textContent = node.description;
      root.append(description);
    }
    const routes = document.createElement("div");
    routes.className = "grand-exploration__routes";
    for (const route of getAvailableRoutes(this.saveGame, this.map)) {
      const destination = this.map.nodes.find((item) => item.id === route.destinationId);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = route.label || `Travel to ${destination?.label || route.destinationId}`;
      button.addEventListener("click", () => this.travel(route.id));
      routes.append(button);
    }
    root.append(routes);
    (this.params.mount || document.body).append(root);
    this.root = root;
  }

  travel(edgeId) {
    const result = traverseRoute(this.saveGame, this.map, edgeId);
    this.saveGame = result.saveGame;
    this.persist();
    if (result.triggerId && typeof this.params.onTrigger === "function") this.params.onTrigger(result, this.saveGame);
    else this.render();
  }

  persist() { if (typeof this.params.onSaveGame === "function") this.params.onSaveGame(this.saveGame); }
  cleanup() { this.root?.remove(); this.root = null; }
}
