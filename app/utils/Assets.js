// app/utils/Assets.js — merged from legacy and new versions
const _state = {
  base: new URL("../assets/", import.meta.url),
  registry: {
    images: {
  "ui.logo": "ui/dndlogo.png",
  "ui.mainscreen": "images/mainscreen.png",
  "ui.murky": "backgrounds/murky-background.png",
  "fx.sunburst": "fx/sunburst.png",
  "fx.flame": "fx/flame.png",
  "fx.fogTexture": "fx/fog-texture.png",
  "pc.placeholder": "sprites/pc_nobody.png",
  "death.screen": "ui/death.png"
},
    audio: {
  "music.intro": "../assets/audio/intro_theme.mp3"
},
    data: {},
    images_v2: {},
    audio_v2: {},
    data_v2: {}
  }
};

function _toURL(input){
  if (!input) throw new Error("Assets.getPath: missing input");
  if (input instanceof URL) return input;
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input) || /^file:\/\//i.test(input)) return new URL(input);
    return new URL(input, _state.base);
  }
  throw new Error("Assets.getPath: unsupported input type");
}

function _lookup(key){
  if (typeof key !== "string") return null;
  const [ns, ...rest] = key.split(".");
  if (rest.length) return _state.registry?.[ns]?.[key] || null;
  return _state.registry.images?.[key]
      || _state.registry.audio?.[key]
      || _state.registry.data?.[key]
      || null;
}

export const Assets = {
  setBase(newBase){
    _state.base = newBase ? _toURL(newBase) : new URL("../assets/", import.meta.url);
    return _state.base;
  },
  getBase(){ return _state.base; },
  register(partial){
    if (!partial || typeof partial !== "object") return;
    for (const ns of Object.keys(partial)){
      _state.registry[ns] = { ...( _state.registry[ns] || {} ), ...(partial[ns] || {}) };
    }
  },
  getPath(keyOrPath, namespaceHint){
    const aliased = _lookup(keyOrPath) || (namespaceHint && _state.registry?.[namespaceHint]?.[keyOrPath]);
    const rel = aliased || keyOrPath;
    return _toURL(rel);
  },
  path(keyOrPath, namespaceHint){
    return this.getPath(keyOrPath, namespaceHint).toString();
  },
  list(namespace){
    const tbl = _state.registry[namespace] || {};
    return Object.values(tbl).map(rel => _toURL(rel).toString());
  },
  forPixiManifest(){
    const images = Object.entries(_state.registry.images || {}).map(([key, rel]) => ({ alias: key, src: _toURL(rel).toString() }));
    const audio  = Object.entries(_state.registry.audio  || {}).map(([key, rel]) => ({ alias: key, src: _toURL(rel).toString() }));
    const data   = Object.entries(_state.registry.data   || {}).map(([key, rel]) => ({ alias: key, src: _toURL(rel).toString() }));
    return { images, audio, data };
  },
  keys(namespace){ return Object.keys(_state.registry[namespace] || {}); },
  has(key){ return !!_lookup(key); }
};

export default Assets;
