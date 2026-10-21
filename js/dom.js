export const $ = (id) => document.getElementById(id);

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// Remove and re-add a class so its CSS animation plays again.
export function replayClass(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const scrollBehavior = () => (reduceMotion ? "auto" : "smooth");

export const CAMERA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>';
