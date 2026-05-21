import { CLASSES } from "./classes.js";

export const subclasses = {};

for (const [classId, classRecord] of Object.entries(CLASSES)) {
  subclasses[classId] = classRecord.subclasses || {};
  subclasses[classRecord.name] = classRecord.subclasses || {};
}

export default subclasses;
