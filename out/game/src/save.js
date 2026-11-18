// save.js — localStorage save: money, rank, missions done, stashes found,
// best stats. Versioned so an old save never breaks a new build: bump the
// KEY's v-number whenever the shape changes, and loadSave returns null for
// anything it cannot read, so the game always starts clean instead of dying.
const KEY = 'solara-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || !s) return null;
    return {
      money: Number(s.money) || 0,
      rankIndex: Number(s.rankIndex) || 0,
      missionsDone: Array.isArray(s.missionsDone) ? s.missionsDone : [],
      stashes: Array.isArray(s.stashes) ? s.stashes : [],
      busted: Number(s.busted) || 0,
      wasted: Number(s.wasted) || 0,
    };
  } catch { return null; }
}

export function writeSave(G) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: G.money,
      rankIndex: G.rankIndex,
      missionsDone: G.missionsDone,
      stashes: G.stashesFound,
      busted: G.busted,
      wasted: G.wasted,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}
