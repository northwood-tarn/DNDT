import { createSecretDefinition, validateSecretDefinition } from "../../app/secrets/secretDefinition.js";

const form = document.querySelector("#secret-form"), clues = document.querySelector("#clues"), template = document.querySelector("#clue-template");
let referenceCatalogue = [];
let mediaRecorder = null, recordingStream = null, recordingChunks = [], recordingTimer = null;
document.querySelector("#close").addEventListener("click", () => window.api?.quit?.());
document.querySelector("#add-clue").addEventListener("click", () => addClue());
document.querySelector("#validate").addEventListener("click", () => render());
form.addEventListener("input", () => render());
document.querySelector("#location-filter").addEventListener("input", () => refreshSourcePickers());
form.addEventListener("submit", async (event) => { event.preventDefault(); const { secret, errors } = render(); if (errors.length) return; const result = await window.api?.saveSecret?.(secret); document.querySelector("#status").textContent = result?.ok ? `Saved ${result.path}` : "Save unavailable"; });
document.querySelector("#record-draft").addEventListener("click", startRecording);
document.querySelector("#stop-recording").addEventListener("click", stopRecording);
document.querySelector("#generate-draft").addEventListener("click", generateDraft);

function addClue(value = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  for (const [field, data] of Object.entries({ id: value.id, name: value.name, description: value.description, sourceType: value.source?.type, mapId: value.source?.mapId })) if (data != null) node.querySelector(`[data-field="${field}"]`).value = data;
  const type = node.querySelector('[data-field="sourceType"]'), mapField = node.querySelector("[data-map-field]");
  const sync = () => { mapField.hidden = type.value !== "node"; mapField.querySelector("input").required = type.value === "node"; populateSourcePicker(node); };
  type.addEventListener("change", sync); node.querySelector(".remove").addEventListener("click", () => { node.remove(); render(); }); clues.append(node); sync();
  if (value.source?.id) ensureSourceOption(node, value.source);
  render();
}
function build() {
  const data = new FormData(form), parse = (name, fallback) => { try { return JSON.parse(data.get(name) || JSON.stringify(fallback)); } catch { throw new Error(`${name} is not valid JSON`); } };
  return createSecretDefinition({ id:data.get("id"), title:data.get("title"), target:{id:data.get("targetId"),label:data.get("targetLabel")}, clueThreshold:Number(data.get("threshold")), clues:[...clues.querySelectorAll(".clue")].map((row)=>{const get=(name)=>row.querySelector(`[data-field="${name}"]`).value;return{id:get("id"),name:get("name"),description:get("description"),source:{type:get("sourceType"),id:get("sourceId"),...(get("sourceType")==="node"?{mapId:get("mapId")}:{})}}}), inventory:{searchingText:data.get("inventoryText")}, journal:{searching:data.get("journalSearching"),milestones:parse("milestones",[]),uncovered:data.get("journalUncovered"),unlocked:data.get("journalUnlocked"),completed:data.get("journalCompleted")}, rewardItems:String(data.get("rewards")||"").split(/\n/).map(v=>v.trim()).filter(Boolean), unlockRequirements:parse("requirements",[]), effects:parse("effects",{}) });
}
function render() { let secret=null, errors=[]; try { secret=build(); errors=validateSecretDefinition(secret); } catch(error) { errors=[error.message]; } document.querySelector("#preview").textContent=secret?JSON.stringify(secret,null,2):""; document.querySelector("#errors").textContent=errors.join("\n"); document.querySelector("#status").textContent=errors.length?`${errors.length} issue${errors.length===1?"":"s"}`:"Valid"; return{secret,errors}; }
addClue();

function refreshSourcePickers() { for (const row of clues.querySelectorAll(".clue")) populateSourcePicker(row); }
function populateSourcePicker(row) {
  const type = row.querySelector('[data-field="sourceType"]').value, select = row.querySelector('[data-field="sourceId"]'), previous = select.value;
  const filter = document.querySelector("#location-filter").value.trim();
  const matches = referenceCatalogue.filter((entry) => entry.type === type && (!filter || entry.locationId === filter));
  select.replaceChildren(new Option(matches.length ? "Choose an existing ID" : "No matching IDs found", ""));
  for (const entry of matches) { const option = new Option(`${entry.id}${entry.locationId ? ` — ${entry.locationId}` : ""}`, entry.id); option.dataset.mapId = entry.mapId || ""; select.append(option); }
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  select.onchange = () => { const chosen = select.selectedOptions[0]; row.querySelector('[data-field="mapId"]').value = chosen?.dataset.mapId || ""; row.querySelector("[data-source-note]").textContent = chosen?.value ? `Linked to ${chosen.value}` : ""; render(); };
}
function ensureSourceOption(row, source) {
  const select = row.querySelector('[data-field="sourceId"]');
  let option = [...select.options].find((candidate) => candidate.value === source.id);
  if (!option) { option = new Option(`${source.id} — unresolved reference`, source.id); option.dataset.mapId = source.mapId || ""; select.append(option); }
  select.value = source.id;
  row.querySelector('[data-field="mapId"]').value = source.mapId || option.dataset.mapId || "";
}

window.api?.listSecretReferences?.().then((records) => {
  referenceCatalogue = Array.isArray(records) ? records : [];
  const locations = [...new Set(referenceCatalogue.flatMap((entry) => [entry.type === "location" ? entry.id : null, entry.locationId]).filter(Boolean))].sort();
  const list = document.querySelector("#location-ids");
  for (const id of locations) list.append(new Option(id, id));
  refreshSourcePickers();
});

window.api?.getSecretAiStatus?.().then((status) => {
  const ready = status?.ollama === true && status?.model === true;
  document.querySelector("#ai-status").textContent = ready ? `Ready · ${status.modelName}` : status?.message || "Local AI setup incomplete";
  document.querySelector("#generate-draft").disabled = !ready;
  document.querySelector("#record-draft").disabled = status?.whisper !== true;
});

async function startRecording() {
  const result = document.querySelector("#ai-result");
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.addEventListener("dataavailable", (event) => { if (event.data.size) recordingChunks.push(event.data); });
    mediaRecorder.addEventListener("stop", transcribeRecording, { once: true });
    mediaRecorder.start();
    document.querySelector("#record-draft").hidden = true; document.querySelector("#stop-recording").hidden = false;
    result.textContent = "Recording…";
    recordingTimer = globalThis.setTimeout(stopRecording, 30000);
  } catch (error) { result.textContent = `Microphone unavailable: ${error.message}`; }
}

function stopRecording() {
  if (recordingTimer) globalThis.clearTimeout(recordingTimer);
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  recordingStream?.getTracks().forEach((track) => track.stop());
  document.querySelector("#record-draft").hidden = false; document.querySelector("#stop-recording").hidden = true;
}

async function transcribeRecording() {
  const result = document.querySelector("#ai-result"); result.textContent = "Transcribing locally…";
  try {
    const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || "audio/webm" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    const response = await window.api.transcribeSecretDraft({ audioBase64: btoa(binary), mimeType: blob.type });
    document.querySelector("#ai-prompt").value = response.transcript || "";
    result.textContent = `Transcribed in ${(response.elapsedMs / 1000).toFixed(1)}s. Review the text, then generate.`;
  } catch (error) { result.textContent = `Transcription failed: ${error.message}`; }
}

async function generateDraft() {
  const description = document.querySelector("#ai-prompt").value.trim(), result = document.querySelector("#ai-result");
  if (!description) { result.textContent = "Describe the secret first."; return; }
  result.textContent = "Generating locally…"; document.querySelector("#generate-draft").disabled = true;
  try {
    const locationId = document.querySelector("#location-filter").value.trim() || form.elements.targetId.value.trim();
    const references = referenceCatalogue.filter((entry) => !locationId || entry.locationId === locationId);
    const response = await window.api.generateSecretDraft({ description, locationId, references });
    applyDraft(response.secret);
    const validation = render();
    result.textContent = `Generated in ${(response.elapsedMs / 1000).toFixed(1)}s · ${validation.errors.length} validator issue${validation.errors.length === 1 ? "" : "s"}. AI draft—review before saving.`;
  } catch (error) { result.textContent = `Generation failed: ${error.message}`; }
  finally { document.querySelector("#generate-draft").disabled = false; }
}

function applyDraft(secret) {
  const set = (name, value) => { form.elements[name].value = value ?? ""; };
  set("id", secret.id); set("title", secret.title); set("targetId", secret.target?.id); set("targetLabel", secret.target?.label); set("threshold", secret.clueThreshold);
  set("inventoryText", secret.inventory?.searchingText); set("journalSearching", secret.journal?.searching); set("journalUncovered", secret.journal?.uncovered); set("journalUnlocked", secret.journal?.unlocked); set("journalCompleted", secret.journal?.completed);
  set("milestones", JSON.stringify(secret.journal?.milestones || [], null, 2)); set("rewards", (secret.rewardItems || []).join("\n")); set("requirements", JSON.stringify(secret.unlockRequirements || [], null, 2)); set("effects", JSON.stringify(secret.effects || { uncovered: [], unlocked: [], completed: [] }, null, 2));
  clues.replaceChildren(); for (const clue of secret.clues || []) addClue(clue);
}
