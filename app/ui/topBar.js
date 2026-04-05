// app/ui/topBar.js
// Simple top bar UI component.
// Does not own routing; it only renders status/title.
//
// Contract:
//   mountTopBar(opts: {
//     mode?: string,
//     actTitle?: string,
//     areaTitle?: string,
//     timeLabel?: string,
//     weatherLabel?: string,
//     getPlayer?: () => any,
//     onLanternToggle?: (on: boolean) => void
//   }) -> HTMLElement
//   ensureTopBar() -> HTMLElement
//   setTopBarTitle(title: string) -> void
//   setTopBarSubtitle(text: string) -> void

import { ensureLayout } from "./layout.js";

const TOPBAR_ID = "top-bar";
const TITLE_ID = "top-bar-title";
const SUBTITLE_ID = "top-bar-subtitle";

export function ensureTopBar() {
  const { uiRootEl } = ensureLayout();

  let bar = document.getElementById(TOPBAR_ID);
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = TOPBAR_ID;

  const title = document.createElement("div");
  title.id = TITLE_ID;
  title.textContent = "";

  const subtitle = document.createElement("div");
  subtitle.id = SUBTITLE_ID;
  subtitle.textContent = "";

  bar.appendChild(title);
  bar.appendChild(subtitle);

  // Put it at the top of UI root.
  uiRootEl.prepend(bar);

  return bar;
}

export function mountTopBar(opts = {}) {
  const bar = ensureTopBar();

  // Minimal deterministic rendering: compose a title/subtitle from provided fields.
  // Visual styling/layout is handled by CSS.
  const mode = opts.mode ? String(opts.mode) : "";
  const actTitle = opts.actTitle ? String(opts.actTitle) : "";
  const areaTitle = opts.areaTitle ? String(opts.areaTitle) : "";
  const timeLabel = opts.timeLabel ? String(opts.timeLabel) : "";
  const weatherLabel = opts.weatherLabel ? String(opts.weatherLabel) : "";

  const titleParts = [];
  if (actTitle) titleParts.push(actTitle);
  if (areaTitle) titleParts.push(areaTitle);
  setTopBarTitle(titleParts.join(" — "));

  const subParts = [];
  if (mode) subParts.push(mode);
  if (timeLabel) subParts.push(timeLabel);
  if (weatherLabel) subParts.push(weatherLabel);
  setTopBarSubtitle(subParts.join(" · "));

  // Future: if we add controls (lantern toggle, etc.), they belong inside this module.
  // For now we only expose the mount point and text.

  return bar;
}

export function setTopBarTitle(text) {
  ensureTopBar();
  const el = document.getElementById(TITLE_ID);
  if (el) el.textContent = text ?? "";
}

export function setTopBarSubtitle(text) {
  ensureTopBar();
  const el = document.getElementById(SUBTITLE_ID);
  if (el) el.textContent = text ?? "";
}