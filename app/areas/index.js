// app/areas/index.js
// Minimal area loader registry
import { FIELDS_META, fieldsTriggerAt } from "./fields/area.fields.js";

const registry = {
  fields: {
    meta: FIELDS_META,
    triggerAt: fieldsTriggerAt
  }
};

export function loadArea(areaId){
  return registry[areaId] || registry.fields;
}
