// Settings from config.js, plus the app state shared between modules.
export const CFG = window.LBA_CONFIG || {};
export const GOAL = Math.max(1, Number(CFG.GOAL) || 100);

export const state = {
  records: [],      // oldest first
  currentId: null,  // card on top of the deck
  ownPending: null, // id this viewer just added
  adminOpen: false, // admin table showing
};

export const rankOf = (id) => state.records.findIndex((r) => r.id === id);
