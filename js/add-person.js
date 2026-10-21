// The "Add one more" sheet.
import { $, CAMERA_SVG, reduceMotion, scrollBehavior } from "./dom.js";
import { GOAL, state, rankOf } from "./state.js";
import { haptic, tgBack, tgName } from "./telegram.js";
import { todayISO, uuid } from "./utils.js";
import { toast } from "./toast.js";
import { processPhoto } from "./photo.js";
import { addEntry, load } from "./data.js";
import { celebrate } from "./mosaic.js";
import { renderDeck } from "./deck.js";
import { afterOverlayClose } from "./admin.js";

const modal = $("modal");
let photo = null; // { blob, thumb }
let lastFocus = null;

/* ---------- Open / close ---------- */
export function openModal() {
  lastFocus = document.activeElement;
  const k = state.records.length;
  $("mSpot").textContent = k < GOAL ? `No. ${k + 1} of ${GOAL}` : `No. ${k + 1} · beyond the goal`;
  if (!$("fDate").value) $("fDate").value = todayISO();
  $("formErr").hidden = true;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  tgBack(closeModal);
}
export function closeModal() {
  modal.hidden = true;
  afterOverlayClose();
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
export const isModalOpen = () => !modal.hidden;

$("addBtn").addEventListener("click", () => { haptic.tap(); openModal(); });
$("closeBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

/* ---------- Added by: filled in from the Telegram account, not editable ---------- */
if (tgName) { const b = document.createElement("b"); b.textContent = tgName; $("fAddedBy").appendChild(b); }
else $("fAddedBy").textContent = "Your Telegram name (open the wall in Telegram)";

/* ---------- Photo ---------- */
function resetPhoto(title, sub) {
  photo = null;
  $("thumb").innerHTML = CAMERA_SVG;
  $("pickTitle").textContent = title;
  $("pickSub").textContent = sub;
}
resetPhoto("Add a photo", "Take one or choose from your phone");

$("fPhoto").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  $("pickTitle").textContent = "Preparing photo…";
  try {
    photo = await processPhoto(file);
    const t = $("thumb"); t.textContent = "";
    const i = document.createElement("img"); i.alt = ""; i.src = photo.thumb; t.appendChild(i);
    $("pickTitle").textContent = "Photo added";
    $("pickSub").textContent = "Tap to change it";
  } catch (_) {
    resetPhoto("That photo couldn't be read", "Try a different photo");
  }
});

function resetForm() {
  $("form").reset();
  $("fDate").value = todayISO();
  resetPhoto("Add a photo", "Take one or choose from your phone");
}

/* ---------- Submit ---------- */
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("formErr");
  const name = $("fName").value.trim(), brought_by = $("fBy").value.trim(), date = $("fDate").value, svc = $("fSvc").value, shared = $("fShared").value.trim();
  const missing = [!name && "a name", !brought_by && "who brought them", !date && "a date", !svc && "the service"].filter(Boolean);
  if (missing.length) { err.textContent = `Add ${missing.join(", ")} to continue.`; err.hidden = false; haptic.bad(); return; }

  const btn = $("submitBtn");
  btn.disabled = true; btn.textContent = "Adding…"; err.hidden = true;
  const id = uuid();
  state.ownPending = id; // so the live update doesn't celebrate it twice
  try {
    await addEntry(id, { name, brought_by, date, svc, shared }, photo);
    await load();
    closeModal();
    resetForm();
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    const k = rankOf(id);
    haptic.ok();
    celebrate(id, reduceMotion ? 0 : 650);
    toast(k >= 0 && k < GOAL ? `Welcome, ${name}. You're No. ${k + 1}.` : `Welcome, ${name}.`);
    state.currentId = id; renderDeck();
  } catch (ex) {
    state.ownPending = null;
    haptic.bad();
    err.textContent = ex && ex.stage === "photo"
      ? "The photo didn't upload. Try a smaller photo, or add them without one."
      : "That didn't save. Check your connection and try again.";
    err.hidden = false;
    console.error(ex);
  } finally {
    btn.disabled = false; btn.textContent = "Add to the wall";
  }
});
