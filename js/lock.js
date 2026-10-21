// Password lock screen. Once unlocked, this device stays unlocked until the password changes.
import { $, replayClass, reduceMotion } from "./dom.js";
import { haptic } from "./telegram.js";
import { replayEntrance } from "./mosaic.js";

// SHA-256 of the password, so the password itself isn't written in this file.
// To change it: replace this with the SHA-256 of the new password (lowercase).
const PASSWORD_HASH = "3a2c303164680af0109092b6e654db91481443c1e18a5b311390ad3438119748";
const UNLOCK_KEY = "lba100-unlocked";
const WRONG = [
  ["Nope. That password is un-LBA-lievable.", "Try again, we believe in you."],
  ["Close, but no orange.", "Your tile stays grey for now. Try again."],
  ["Wrong key! Even the tiles are grey about it.", "Have another go."],
  ["Access denied. Don't worry, we won't tile anyone.", "Check with your organiser and try again."],
  ["Hmm. That's a pass-weird, not a password.", "One more try?"],
  ["Plot twist: that's not it.", "The wall is rooting for you. Try again."],
  ["Nice try! The tiles are not impressed.", "Psst, check for typos."],
];

const lock = $("lock"), lockForm = $("lockForm"), pw = $("lockPw"), lockMsg = $("lockMsg");
let wrongCount = 0;
let onUnlock = () => {};

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unlock(animate) {
  try { localStorage.setItem(UNLOCK_KEY, PASSWORD_HASH); } catch (_) {}
  onUnlock();
  if (!animate || reduceMotion) { lock.hidden = true; return; }
  lock.classList.add("open");
  haptic.ok();
  setTimeout(() => {
    lock.classList.add("leaving");
    replayEntrance();
    setTimeout(() => { lock.hidden = true; }, 560);
  }, 380);
}

function showWrong() {
  const [line, sub] = WRONG[wrongCount % WRONG.length];
  wrongCount++;
  lockMsg.textContent = "";
  const b = document.createElement("span"); b.textContent = line;
  const sm = document.createElement("small"); sm.textContent = wrongCount >= 3 ? `Attempt ${wrongCount}. ${sub}` : sub;
  lockMsg.append(b, sm);
  lockMsg.hidden = false;
  lockMsg.style.animation = "none"; void lockMsg.offsetWidth; lockMsg.style.animation = "";
  replayClass(lockForm, "shake");
  haptic.bad();
  pw.select();
}

// Calls `then` once the viewer is in: straight away if this device was unlocked before.
export function initLock(then) {
  onUnlock = then;

  $("pwToggle").addEventListener("click", () => {
    const show = pw.type === "password";
    pw.type = show ? "text" : "password";
    $("pwToggle").textContent = show ? "Hide" : "Show";
    $("pwToggle").setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const guess = pw.value.trim().toLowerCase();
    if (!guess) { pw.focus(); return; }
    let ok = false;
    try { ok = (await sha256(guess)) === PASSWORD_HASH; } catch (_) { ok = false; }
    if (ok) { lockMsg.hidden = true; pw.blur(); unlock(true); }
    else showWrong();
  });

  let remembered = false;
  try { remembered = localStorage.getItem(UNLOCK_KEY) === PASSWORD_HASH; } catch (_) {}
  if (remembered) unlock(false);
  else setTimeout(() => { try { pw.focus(); } catch (_) {} }, 300);
}
