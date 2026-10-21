// Light/dark: the viewer's own choice wins; otherwise follow Telegram, otherwise the phone's setting.
import { $, reduceMotion } from "./dom.js";
import { tg, inTelegram, haptic } from "./telegram.js";

const THEME_KEY = "lba100-theme";
const darkMQ = matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try { const t = localStorage.getItem(THEME_KEY); return t === "dark" || t === "light" ? t : null; } catch (_) { return null; }
}
function currentTheme() {
  return savedTheme() || (inTelegram ? (tg.colorScheme === "dark" ? "dark" : "light") : (darkMQ.matches ? "dark" : "light"));
}
function applyTheme() {
  const mode = currentTheme();
  document.documentElement.setAttribute("data-theme", mode);
  const btn = $("themeBtn");
  btn.dataset.mode = mode;
  btn.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
  if (inTelegram) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch (_) {}
    try { tg.setBottomBarColor && tg.setBottomBarColor(bg); } catch (_) {}
  }
}

export function initTheme() {
  applyTheme();
  try { darkMQ.addEventListener("change", applyTheme); } catch (_) {}
  if (inTelegram) { try { tg.onEvent("themeChanged", applyTheme); } catch (_) {} }
  $("themeBtn").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    if (!reduceMotion) { document.body.classList.add("theme-fade"); setTimeout(() => document.body.classList.remove("theme-fade"), 400); }
    applyTheme();
    haptic.tap();
  });
}
