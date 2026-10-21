// The "view more" sheet: one person's full card, opened from the button on their card in the list.
import { $ } from "./dom.js";
import { GOAL, state, rankOf } from "./state.js";
import { haptic, tgBack } from "./telegram.js";
import { fmtDate, initials } from "./utils.js";
import { afterOverlayClose } from "./admin.js";

const sheet = $("person");
let lastFocus = null;

const span = (cls, text) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; return s; };

export function openPerson(id) {
  const rec = state.records.find((r) => r.id === id);
  if (!rec) return;
  lastFocus = document.activeElement;
  const k = rankOf(id);
  haptic.tap();

  $("pSpot").textContent = k < GOAL ? `No. ${k + 1} of ${GOAL}` : `No. ${k + 1}`;
  $("pName").textContent = rec.name;

  const ph = $("pPhoto");
  ph.textContent = "";
  if (rec.photo || rec.thumb) {
    const img = document.createElement("img");
    img.alt = `Photo of ${rec.name}`;
    img.src = rec.thumb || rec.photo;
    if (rec.thumb && rec.photo) {
      img.className = "blur";
      const full = new Image();
      full.onload = () => { img.src = rec.photo; img.className = ""; };
      full.src = rec.photo;
    }
    ph.appendChild(img);
  } else ph.appendChild(span("initials", initials(rec.name)));

  const chips = $("pChips");
  chips.textContent = "";
  const dt = fmtDate(rec.date);
  if (dt) chips.appendChild(span("chip", dt));
  if (rec.svc) chips.appendChild(span("chip", rec.svc));

  const sh = $("pShared");
  sh.className = "shared full" + (rec.shared ? "" : " none");
  sh.textContent = rec.shared || "No sharing added.";

  const foot = $("pFoot");
  foot.textContent = "";
  foot.appendChild(span("added-by", rec.addedBy ? `Added by ${rec.addedBy}` : ""));
  if (rec.broughtBy) {
    const so = span("signoff", "");
    so.append(span("", "Brought by"), span("sig", rec.broughtBy));
    foot.appendChild(so);
  }

  sheet.hidden = false;
  document.body.style.overflow = "hidden";
  tgBack(closePerson);
  $("pClose").focus();
}

export function closePerson() {
  sheet.hidden = true;
  afterOverlayClose();
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
export const isPersonOpen = () => !sheet.hidden;

$("pClose").addEventListener("click", closePerson);
sheet.addEventListener("click", (e) => { if (e.target === sheet) closePerson(); });
