import assert from "node:assert/strict";
import test from "node:test";
import { compileDialogue, parseDialogueSource } from "../../app/dialogue_upload/dialogueSource.js";

const source=`---
format.version: 1
act: 1_Greyharbour
scene.id: scene:forest.gate
scene.title: Forest Gate
dialogue.type: full
location.id: map:forest.gate
trigger.id: trigger:forest.gate.guards
participants:
  - npc:gate.captain
frequency: once
required.flags: []
forbidden.flags: []
start.effects: []
bypass.effects: []
completion.effects: []
success.destination: null
failure.destination: encounter:forest.gate.guards
---

Text.
oa. Speak. //set.flag=flag:forest.gate.met//
ob. Leave. //go.map=map:forest.road//`;

test("parses header, options, and canonical annotations",()=>{const parsed=parseDialogueSource(source);assert.equal(parsed.header["scene.id"],"scene:forest.gate");assert.equal(parsed.options.length,2);assert.equal(parsed.annotations[0].effect,"set.flag")});
test("compiles a resolved full dialogue",()=>{const parsed=parseDialogueSource(source);const catalogue=[...new Set(JSON.stringify(parsed.header).match(/[a-z]+:[a-z0-9.]+/g))].map(id=>({id}));catalogue.push({id:"flag:forest.gate.met"},{id:"map:forest.road"});const result=compileDialogue(parsed,{catalogue});assert.deepEqual(result.validation.errors,[]);assert.equal(result.package.content.options[0].effects[0].effect,"set.flag")});
test("blocks unresolved natural annotations",()=>{const parsed=parseDialogueSource(source.replace("set.flag=flag:forest.gate.met","open gate"));assert.ok(compileDialogue(parsed).validation.errors.some(e=>e.includes("Resolve //open gate//")))});
test("the scene ID declares itself",()=>{const parsed=parseDialogueSource(source);assert.ok(!compileDialogue(parsed).validation.errors.some(e=>e.includes("scene:forest.gate")))});
test("requests a minimal record for a new narrative participant",()=>{const parsed=parseDialogueSource(source);assert.ok(compileDialogue(parsed).validation.errors.some(e=>e.includes("Create narrative participant npc:gate.captain")))});
