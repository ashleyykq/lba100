// Entry point: wires the modules together and starts the app.
import { $, scrollBehavior } from "./dom.js";
import { GOAL, state, rankOf } from "./state.js";
import { haptic, initTelegram } from "./telegram.js";
import { initTheme } from "./theme.js";
import { toast } from "./toast.js";
import { demo, load, onLoad, watchForChanges } from "./data.js";
import { onTileClick, renderMosaic, setCount, celebrate } from "./mosaic.js";
import { renderDeck, showInDeck, isDragging } from "./deck.js";
import { openModal, closeModal, isModalOpen, renderSvcChips } from "./add-person.js";
import { refreshAdmin, closeAdmin, closeAdminLogin, isAdminLoginOpen } from "./admin.js";
import { initLock } from "./lock.js";

initTheme();
initTelegram();
$("goalNum").textContent = GOAL;

/* ---------- New data → every view ---------- */
let known = null; // ids seen so far; null until the first load

onLoad((records) => {
  $("offline").hidden = true;
  const fresh = known === null ? [] : records.filter((r) => !known.has(r.id));
  known = new Set(records.map((r) => r.id));
  state.records = records;
  setCount(records.length);
  renderMosaic();
  renderSvcChips();
  refreshAdmin();
  if (fresh.length) {
    if (!isDragging()) state.currentId = fresh[fresh.length - 1].id;
    for (const r of fresh) {
      if (r.id === state.ownPending) continue;
      celebrate(r.id);
      haptic.tap();
      const k = rankOf(r.id);
      toast(k < GOAL ? `${r.name} just joined · No. ${k + 1}` : `${r.name} just joined`);
    }
  }
  renderDeck();
}, () => {
  $("offline").hidden = false;
  if (known === null) $("leftText").textContent = `${GOAL} spots to go`;
});

/* ---------- Navigation ---------- */
const scrollToNewest = () => $("newest").scrollIntoView({ behavior: scrollBehavior() });

onTileClick((id) => {
  haptic.tap();
  if (id) { showInDeck(id); scrollToNewest(); }
  else openModal();
});
$("cue").addEventListener("click", (e) => { e.preventDefault(); scrollToNewest(); });

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (isModalOpen()) closeModal();
  else if (isAdminLoginOpen()) closeAdminLogin();
  else if (state.adminOpen) closeAdmin();
});

/* ---------- Start once unlocked ---------- */
initLock(() => {
  if (demo) $("demo").hidden = false;
  else watchForChanges();
  renderDeck();
  load();
});
