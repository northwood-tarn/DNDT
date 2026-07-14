const services = new Map();

export function registerNpcService(serviceId, definition) {
  if (!serviceId) throw new Error("NPC service ID is required");
  services.set(serviceId, structuredClone(definition));
}

export function getNpcService(serviceId) {
  const definition = services.get(serviceId);
  return definition ? structuredClone(definition) : null;
}

export function clearNpcServiceRegistry() { services.clear(); }
