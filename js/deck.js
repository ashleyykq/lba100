// Screen 2: an endless swipe deck of everyone, newest first.
import { $, reduceMotion } from "./dom.js";
import { GOAL, state, rankOf } from "./state.js";
import { haptic } from "./telegram.js";
import { fmtDate, initials } from "./utils.js";

const deck = $("deck");
const newestFirst = () => state.records.slice().reverse();
let pos = 0;

function cardEl(rec, layer) {
  const k = rankOf(rec.id);
  const card = document.createElement("article");
  card.className = "card " + layer;
  card.dataset.id = rec.id;

  const ph = document.createElement("div");
  ph.className = "photo";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = k < GOAL ? `No. ${k + 1} of ${GOAL}` : `No. ${k + 1}`;
  ph.appendChild(badge);
  if (Date.now() - rec.createdAt < 10 * 60 * 1000) {
    const nb = document.createElement("span"); nb.className = "badge new"; nb.textContent = "Just joined"; ph.appendChild(nb);
  }
  if (rec.photo || rec.thumb) {
    // Show the blurred thumbnail straight away, then swap in the full photo once it's loaded.
    const img = document.createElement("img");
    img.alt = `Photo of ${rec.name}`; img.draggable = false;
    if (rec.thumb) { img.src = rec.thumb; img.className = "blur"; }
    ph.appendChild(img);
    if (rec.photo) {
      const full = new Image();
      full.onload = () => { img.src = rec.photo; img.className = ""; };
      full.src = rec.photo;
    }
  } else {
    const ini = document.createElement("div"); ini.className = "initials"; ini.textContent = initials(rec.name); ph.appendChild(ini);
  }
  card.appendChild(ph);

  const meta = document.createElement("div");
  meta.className = "meta";
  const nm = document.createElement("h3"); nm.className = "name"; nm.textContent = rec.name;
  const chips = document.createElement("div"); chips.className = "chips";
  if (rec.svc) { const c = document.createElement("span"); c.className = "chip"; c.textContent = rec.svc; chips.appendChild(c); }
  const dt = fmtDate(rec.date);
  if (dt) { const c = document.createElement("span"); c.className = "chip date"; c.textContent = dt; chips.appendChild(c); }
  const sh = document.createElement("p");
  sh.className = "shared" + (rec.shared ? "" : " none");
  sh.textContent = rec.shared || "No sharing added.";
  meta.append(nm, chips, sh);
  if (rec.addedBy) {
    const so = document.createElement("p"); so.className = "signoff";
    const lead = document.createElement("span"); lead.textContent = "With thanks,";
    const sig = document.createElement("span"); sig.className = "sig"; sig.textContent = rec.addedBy;
    so.append(lead, sig);
    meta.appendChild(so);
  }
  card.appendChild(meta);
  return card;
}

export function renderDeck() {
  const list = newestFirst();
  const n = list.length;
  deck.textContent = "";
  $("prevBtn").disabled = $("nextBtn").disabled = n < 2;
  $("hint").hidden = n < 2;
  if (!n) {
    const e = document.createElement("div");
    e.className = "empty";
    const s = document.createElement("strong"); s.textContent = "No one on the wall yet";
    const p = document.createElement("span"); p.textContent = "Tap the +1 more sticker to add the first person.";
    e.append(s, p);
    deck.appendChild(e);
    $("pos").textContent = "0 / 0";
    return;
  }
  if (state.currentId) { const i = list.findIndex((r) => r.id === state.currentId); pos = i >= 0 ? i : Math.min(pos, n - 1); }
  pos = ((pos % n) + n) % n;
  state.currentId = list[pos].id;
  const layers = ["top", "second", "third"];
  for (let i = Math.min(3, n) - 1; i >= 0; i--) deck.appendChild(cardEl(list[(pos + i) % n], layers[i]));
  $("pos").textContent = `${pos + 1} / ${n}`;
  const ahead = list[(pos + 3) % n];
  if (ahead && ahead.photo) { const pre = new Image(); pre.src = ahead.photo; }
}

export function showInDeck(id) { state.currentId = id; renderDeck(); }

/* ---------- Buttons + keys ---------- */
let flying = false;
function fly(dir) { // -1 = swiped left (older), +1 = swiped right (newer)
  const n = state.records.length;
  const top = deck.querySelector(".card.top");
  if (!top || flying) return;
  if (n < 2) { top.animate([{ transform: "none" }, { transform: `translateX(${dir * 18}px) rotate(${dir * 3}deg)` }, { transform: "none" }], { duration: 320 }); return; }
  flying = true;
  haptic.tick();
  const done = () => { flying = false; pos += dir < 0 ? 1 : -1; state.currentId = null; renderDeck(); };
  if (reduceMotion) return done();
  top.style.transition = "transform .3s cubic-bezier(.4,0,.8,.6), opacity .3s";
  top.style.transform = `translateX(${dir * 130}%) rotate(${dir * 16}deg)`;
  top.style.opacity = "0";
  setTimeout(done, 280);
}
$("nextBtn").addEventListener("click", () => fly(-1));
$("prevBtn").addEventListener("click", () => fly(1));
deck.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); fly(-1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); fly(1); }
});

/* ---------- Swipe ---------- */
let drag = null;
export const isDragging = () => drag !== null;

deck.addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".card.top");
  if (!card || e.target.closest("button") || flying) return;
  drag = { card, x0: e.clientX, y0: e.clientY, dx: 0, t0: performance.now(), pid: e.pointerId, axis: null };
});
deck.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
    drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (drag.axis === "y") { drag = null; return; } // vertical: let the page scroll
    try { drag.card.setPointerCapture(e.pointerId); } catch (_) {}
    drag.card.style.transition = "none";
    drag.card.style.animation = "none";
  }
  if (drag.axis === "x") {
    drag.dx = dx;
    drag.card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const { card, dx, t0, axis } = drag;
  drag = null;
  if (axis !== "x") return;
  const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
  if (Math.abs(dx) > 90 || (v > .5 && Math.abs(dx) > 30)) fly(dx < 0 ? -1 : 1);
  else { card.style.transition = "transform .35s cubic-bezier(.3,1.5,.5,1)"; card.style.transform = ""; }
};
deck.addEventListener("pointerup", endDrag);
deck.addEventListener("pointercancel", endDrag);
