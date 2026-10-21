// Telegram Mini App bridge: the user's name, theme, haptics and back button.
// Everything here is a no-op outside Telegram.
const wa = window.Telegram && window.Telegram.WebApp;
export const tg = wa && wa.initData !== undefined ? wa : null;
export const inTelegram = !!(tg && tg.initData);

export const haptic = {
  tap() { try { tg && tg.HapticFeedback.impactOccurred("light"); } catch (_) {} },
  tick() { try { tg && tg.HapticFeedback.selectionChanged(); } catch (_) {} },
  ok() { try { tg && tg.HapticFeedback.notificationOccurred("success"); } catch (_) {} },
  bad() { try { tg && tg.HapticFeedback.notificationOccurred("error"); } catch (_) {} },
};

const tgUser = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
export const tgName = tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").slice(0, 60) : "";

export function initTelegram() {
  if (!inTelegram) return;
  try { tg.ready(); tg.expand(); } catch (_) {}
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (_) {}
}

// Point Telegram's back button at `fn` (or hide it with null).
let backFn = null;
export function tgBack(fn) {
  // Hide the light/dark button while a pop-up or the admin table is open, so it never covers a close button.
  document.body.classList.toggle("overlay-open", !!fn);
  if (!inTelegram) return;
  try {
    if (backFn) tg.BackButton.offClick(backFn);
    backFn = fn;
    if (fn) { tg.BackButton.onClick(fn); tg.BackButton.show(); } else tg.BackButton.hide();
  } catch (_) {}
}
