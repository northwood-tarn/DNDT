// app/data/mergeSubclasses.js
// Merges base class chassis from classes.js with subclass definitions from subclasses.js.
// Usage:
//   import { mergeClasses } from "./mergeSubclasses.js";
//   const CLASSES = mergeClasses(); // shape: classes[className].subclasses

import { classes } from "./dlasses.js";
import { subclasses } from "./wubclasses.js";

export function mergeClasses() {
  const merged = JSON.parse(JSON.stringify(classes));
  for (const className of Object.keys(subclasses)) {
    if (!merged[className]) merged[className] = {};
    merged[className].subclasses = {
      ...(merged[className].subclasses || {}),
      ...subclasses[className]
    };
  }
  return merged;
}

export default mergeClasses;
