const APP_ROOT = new URL("../", import.meta.url);

export function resolveItemIcon(item) {
  const source = item?.icon?.src;
  if (!source) return null;
  return {
    id: item.id,
    url: new URL(source, APP_ROOT).href,
    width: Number(item.icon.width) || 80,
    height: Number(item.icon.height) || 80,
  };
}

export function createItemIconImage(item, className = "item-icon-art") {
  const resolved = resolveItemIcon(item);
  if (!resolved) return null;
  const image = document.createElement("img");
  image.className = className;
  image.src = resolved.url;
  image.alt = "";
  image.width = resolved.width;
  image.height = resolved.height;
  image.draggable = false;
  image.dataset.itemIconId = resolved.id;
  return image;
}
