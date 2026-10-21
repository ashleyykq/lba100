// Screen 1: the counter and the word "LBA" built from 100 tiles.
import { $, replayClass, reduceMotion } from "./dom.js";
import { GOAL, state, rankOf } from "./state.js";

/* ---------- Build the word from exactly 100 tiles ---------- */
const GLYPHS = {
  L: ["XX...","XX...","XX...","XX...","XX...","XX...","XX...","XXXXX","XXXXX"],
  B: ["XXXXX..","XX..XX.","XX...XX","XX..XX.","XXXX...","XX..XX.","XX...XX","XX..XX.","XXXXX.."],
  A: ["..XXX..",".XX.XX.","XX...XX","XX...XX","XXXXXXX","XX...XX","XX...XX","XX...XX","XX...XX"],
};
const SPACE = 2, ROWS = 9;
const cells = [];
let x = 0;
[..."LBA"].forEach((ch, letter) => {
  const g = GLYPHS[ch];
  g.forEach((row, r) => [...row].forEach((v, c) => { if (v === "X") cells.push({ r, c: x + c, letter }); }));
  x += g[0].length + SPACE;
});
const COLS = x - SPACE;
const mosaic = $("mosaic");
mosaic.style.setProperty("--cols", COLS);
mosaic.style.setProperty("--rows", ROWS);

// Fill order: letter by letter (L, then B, then A). Inside each letter, top row to bottom row,
// and each row from left to right. First person = top-left tile of the L.
const fillOrder = cells.map((_, i) => i).sort((a, b) =>
  cells[a].letter - cells[b].letter || cells[a].r - cells[b].r || cells[a].c - cells[b].c);

const tiles = cells.map(({ r, c }) => {
  const b = document.createElement("button");
  b.className = "tile";
  b.style.gridRow = r + 1; b.style.gridColumn = c + 1;
  b.style.setProperty("--r", r); b.style.setProperty("--c", c);
  b.setAttribute("aria-label", "Open spot");
  mosaic.appendChild(b);
  return b;
});
// With 100 tiles, person k lights tile k. With a different goal, people spread across the word.
const TILE_COUNT = tiles.length;
const tileForRank = (k) => (k < GOAL ? tiles[fillOrder[Math.floor(k * TILE_COUNT / GOAL)]] : null);

// handler(id) gets the person's id for a lit tile, or null for an open spot.
export function onTileClick(handler) {
  mosaic.addEventListener("click", (e) => {
    const t = e.target.closest(".tile");
    if (t) handler(t.dataset.id || null);
  });
}

/* ---------- Counter ---------- */
let shown = 0, countRaf = 0;
export function setCount(n) {
  cancelAnimationFrame(countRaf);
  const from = shown, start = performance.now(), dur = reduceMotion ? 0 : 700;
  const step = (t) => {
    const p = dur ? Math.min(1, (t - start) / dur) : 1;
    shown = Math.round(from + (n - from) * (1 - Math.pow(1 - p, 3)));
    $("countNum").textContent = shown;
    if (p < 1) countRaf = requestAnimationFrame(step);
  };
  countRaf = requestAnimationFrame(step);
  const left = GOAL - n;
  $("leftText").textContent = left > 0 ? `${left} ${left === 1 ? "spot" : "spots"} to go` : `Goal reached · ${n} joined`;
}

/* ---------- Render ---------- */
export function renderMosaic() {
  const { records } = state;
  const lit = new Map();
  for (let k = 0; k < Math.min(GOAL, records.length); k++) lit.set(tileForRank(k), records[k]);
  for (const t of tiles) {
    const rec = lit.get(t);
    const img = t.querySelector("img");
    if (rec) {
      const k = rankOf(rec.id);
      t.classList.add("on");
      t.dataset.id = rec.id;
      t.setAttribute("aria-label", `No. ${k + 1}, ${rec.name}`);
      t.title = rec.name;
      if (rec.thumb) {
        if (!img) { const i = document.createElement("img"); i.alt = ""; i.src = rec.thumb; t.appendChild(i); }
        else if (img.getAttribute("src") !== rec.thumb) img.src = rec.thumb;
      } else if (img) img.remove();
    } else {
      t.classList.remove("on");
      delete t.dataset.id;
      t.setAttribute("aria-label", "Open spot");
      t.removeAttribute("title");
      if (img) img.remove();
    }
  }
}

// Play the tiles' entrance animation again (after the lock screen slides away).
export function replayEntrance() {
  if (reduceMotion) return;
  tiles.forEach((t) => { t.style.animation = "none"; });
  void mosaic.offsetWidth;
  tiles.forEach((t) => { t.style.animation = ""; });
}

/* ---------- Celebrate a new tile ---------- */
function burst(el) {
  if (reduceMotion || !el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 14; i++) {
    const b = document.createElement("span");
    b.className = "bit";
    b.style.left = cx - 4 + "px"; b.style.top = cy - 4 + "px";
    document.body.appendChild(b);
    const a = (Math.PI * 2 * i) / 14 + Math.random() * .4, d = 40 + Math.random() * 50;
    b.animate([
      { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg) scale(.4)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => b.remove();
  }
}

export function celebrate(id, delay = 0) {
  setTimeout(() => {
    const t = tileForRank(rankOf(id));
    if (!t) return;
    replayClass(t, "pop");
    setTimeout(() => burst(t), 260);
    setTimeout(() => t.classList.remove("pop"), 1000);
  }, delay);
}
