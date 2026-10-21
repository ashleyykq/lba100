// Screen 2: everyone, newest first, as a list of horizontal cards shown ten at a time.
// Half of the 11th card peeks out at the bottom; "next" slides the list up to the next ten.
import { $, reduceMotion } from "./dom.js";
import { GOAL, state, rankOf } from "./state.js";
import { haptic } from "./telegram.js";
import { initials } from "./utils.js";
import { openPerson } from "./person.js";

const PAGE = 10;
const deck = $("deck");
const newestFirst = () => state.records.slice().reverse();
let page = 0;
let track = null; // the moving column of cards inside the deck window

function cardEl(rec) {
  const k = rankOf(rec.id);
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = rec.id;

  const ph = document.createElement("div");
  ph.className = "photo";
  if (rec.photo || rec.thumb) {
    // Blurred thumbnail first; the full photo is swapped in when its page comes into view (see loadPhotos).
    const img = document.createElement("img");
    img.alt = `Photo of ${rec.name}`; img.draggable = false;
    if (rec.thumb) { img.src = rec.thumb; img.className = "blur"; }
    if (rec.photo) img.dataset.full = rec.photo;
    ph.appendChild(img);
  } else {
    const ini = document.createElement("div"); ini.className = "initials"; ini.textContent = initials(rec.name); ph.appendChild(ini);
  }
  // Their number, on the photo's top-left corner.
  const num = document.createElement("span"); num.className = "num"; num.textContent = k + 1;
  num.setAttribute("aria-label", k < GOAL ? `No. ${k + 1} of ${GOAL}` : `No. ${k + 1}`);
  ph.appendChild(num);
  card.appendChild(ph);

  const meta = document.createElement("div");
  meta.className = "meta";

  const nameRow = document.createElement("div"); nameRow.className = "name-row";
  const nm = document.createElement("h3"); nm.className = "name"; nm.textContent = rec.name;
  nameRow.appendChild(nm);
  const more = document.createElement("button");
  more.type = "button"; more.className = "more-btn"; more.innerHTML = EXPAND_SVG;
  more.setAttribute("aria-label", `View more about ${rec.name}`);
  nameRow.appendChild(more);

  // Second line: just the date (dd/Mmm). Everything else is in "View more".
  const info = document.createElement("div"); info.className = "info-row";
  const dt = document.createElement("span"); dt.className = "date"; dt.textContent = ddmm(rec.date);
  info.appendChild(dt);

  meta.append(nameRow, info);
  card.appendChild(meta);
  return card;
}

const EXPAND_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/></svg>';

// "2026-10-19" → "19/Oct"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ddmm = (iso) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso || "");
  return m && MONTHS[m[1] - 1] ? `${m[2]}/${MONTHS[m[1] - 1]}` : "";
};

const pageCount = () => Math.max(1, Math.ceil(state.records.length / PAGE));

// Swap in full photos for this page and the next one.
function loadPhotos() {
  const cards = track ? track.children : [];
  for (let i = page * PAGE; i < Math.min(cards.length, (page + 2) * PAGE); i++) {
    const img = cards[i].querySelector("img[data-full]");
    if (!img) continue;
    const src = img.dataset.full;
    delete img.dataset.full;
    const full = new Image();
    full.onload = () => { img.src = src; img.className = ""; };
    full.src = src;
  }
}

// Size the window to ten cards plus half of the 11th, and slide the list to the current page.
function layout(animate) {
  if (!track || !track.children.length) return;
  const cards = track.children;
  const n = cards.length;
  const step = n > 1 ? cards[1].offsetTop - cards[0].offsetTop : cards[0].offsetHeight;
  const peek = n > PAGE;
  deck.style.height = peek ? `${step * PAGE + cards[0].offsetHeight / 2}px` : `${cards[n - 1].offsetTop + cards[n - 1].offsetHeight}px`;
  deck.classList.toggle("peek", peek && page < pageCount() - 1);
  track.style.transition = animate && !reduceMotion ? "" : "none";
  track.style.transform = `translateY(${-cards[page * PAGE].offsetTop}px)`;

  const first = page * PAGE;
  [...cards].forEach((c, i) => { c.classList.toggle("peeking", i === first + PAGE); c.inert = i < first || i > first + PAGE; });
  $("pos").textContent = `${first + 1}–${Math.min(n, first + PAGE)} of ${n}`;
  loadPhotos();
}

// Little stagger on the cards of the page that just came into view.
function settle(dir) {
  if (reduceMotion || !track) return;
  const cards = [...track.children].slice(page * PAGE, page * PAGE + PAGE);
  cards.forEach((c, i) => c.animate(
    [{ transform: `translateY(${dir * 18}px)`, opacity: .35 }, { transform: "none", opacity: 1 }],
    { duration: 420, delay: 60 + i * 28, easing: "cubic-bezier(.2,.9,.3,1)", fill: "backwards" },
  ));
}

export function renderDeck() {
  const list = newestFirst();
  const n = list.length;
  deck.textContent = "";
  track = null;
  deck.style.height = "";
  deck.classList.remove("peek");
  $("prevBtn").disabled = $("nextBtn").disabled = n <= PAGE;
  if (!n) {
    const e = document.createElement("div");
    e.className = "empty";
    const s = document.createElement("strong"); s.textContent = "No one on the wall yet";
    const p = document.createElement("span"); p.textContent = "Tap the +1 more sticker to add the first person.";
    e.append(s, p);
    deck.appendChild(e);
    $("pos").textContent = "0 of 0";
    return;
  }
  // Jump to the page holding a person someone asked to see (a tapped tile, or the person just added).
  let focus = null;
  if (state.currentId) {
    const i = list.findIndex((r) => r.id === state.currentId);
    if (i >= 0) { page = Math.floor(i / PAGE); focus = state.currentId; }
    state.currentId = null;
  }
  page = Math.min(page, pageCount() - 1);

  track = document.createElement("div");
  track.className = "track";
  list.forEach((rec) => track.appendChild(cardEl(rec)));
  deck.appendChild(track);
  layout(false);
  if (focus) {
    const c = track.querySelector(`[data-id="${CSS.escape(focus)}"]`);
    if (c) { c.classList.add("focus"); setTimeout(() => c.classList.remove("focus"), 1800); }
  }
}

export function showInDeck(id) { state.currentId = id; renderDeck(); }

/* ---------- Paging ---------- */
function go(dir) { // +1 = next ten (older), -1 = previous ten (newer); loops at both ends
  if (!track || state.records.length <= PAGE) return;
  haptic.tick();
  const pages = pageCount();
  page = (page + dir + pages) % pages;
  layout(true);
  settle(dir);
}
$("nextBtn").addEventListener("click", () => go(1));
$("prevBtn").addEventListener("click", () => go(-1));
deck.addEventListener("click", (e) => {
  const more = e.target.closest(".more-btn");
  if (more) openPerson(more.closest(".card").dataset.id);
  else if (e.target.closest(".card.peeking")) go(1);
});
deck.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); go(1); }
  if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(-1); }
});
addEventListener("resize", () => layout(false));
document.fonts && document.fonts.ready.then(() => layout(false));
