// ============================================================
// main.js
// エントリーポイント: 状態管理・リアルタイムティック・イベント配線
// ============================================================

import {
  createInitialState,
  performWork,
  tickQliphoth,
  isQuotaMet,
  drawNextCandidates,
  endDay,
  unlockAbnormalityInfo,
  extractEgo,
  log,
} from "./systems/facility.js";
import { createStaff } from "./data/staff.js";
import { createCombatSession, tickCombat, createTrialEnemy, COMBAT_TICK_MS } from "./systems/combat.js";
import { makeEgoWeaponItem, makeEgoArmorItem } from "./data/ego.js";
import {
  renderHeader,
  renderLog,
  renderAbnormalities,
  renderStaff,
  renderDetailModal,
  renderCombatModal,
  renderCandidateModal,
  renderGameOverBanner,
} from "./ui/render.js";

const QLIPHOTH_TICK_MS = 9000; // クリフォトが1つ減るリアルタイム間隔（余裕を持たせた値）
const TRIAL_INTERVAL_MS = 75000; // 試練が発生するリアルタイム間隔

let state = createInitialState();
let combatSession = null;
let combatTimer = null;
let candidateChoices = null;
let detailAbnormalityId = null;
let qliphothTimer = null;
let trialTimer = null;

function checkGameOver() {
  const anyUsable = state.staffList.some((s) => s.alive && s.sane);
  if (state.staffList.length > 0 && !anyUsable) {
    state.gameOver = true;
  }
}

function renderAll() {
  renderHeader(state);
  renderLog(state);
  renderAbnormalities(state, { onWork: handleWork, onOpenDetail: handleOpenDetail });
  renderStaff(state, { onEquipWeapon: handleEquipWeapon, onEquipArmor: handleEquipArmor });
  renderDetailModal(state, detailAbnormalityId, {
    onUnlock: handleUnlock,
    onExtract: handleExtract,
    onClose: handleCloseDetail,
  });
  renderCombatModal(combatSession, state, { onAssignAndStart: handleAssignAndStart, onClose: handleCloseCombat });
  renderCandidateModal(candidateChoices, { onChoose: handleChooseCandidate });
  renderGameOverBanner(state);
}

// ───────── イベントハンドラ ─────────

function handleWork(staffId, abnormalityId, workType) {
  if (state.gameOver || state.cleared) return;
  performWork(state, staffId, abnormalityId, workType);
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (ab && ab.breached && !combatSession) {
    openCombatSetup(ab);
  }
  renderAll();
}

function handleEquipWeapon(staffId, itemId) {
  const staff = state.staffList.find((s) => s.id === staffId);
  const item = state.egoInventory.find((i) => i.id === itemId);
  if (!staff || !item) return;
  staff.equippedWeapon = item;
  log(state, `${staff.name} が ${item.name} を装備した。`);
  renderAll();
}

function handleEquipArmor(staffId, itemId) {
  const staff = state.staffList.find((s) => s.id === staffId);
  const item = state.egoInventory.find((i) => i.id === itemId);
  if (!staff || !item) return;
  staff.equippedArmor = item;
  log(state, `${staff.name} が ${item.name} を装備した。`);
  renderAll();
}

function handleOpenDetail(abnormalityId) {
  detailAbnormalityId = abnormalityId;
  renderAll();
}

function handleCloseDetail() {
  detailAbnormalityId = null;
  renderAll();
}

function handleUnlock(abnormalityId, kind) {
  unlockAbnormalityInfo(state, abnormalityId, kind);
  renderAll();
}

function handleExtract(abnormalityId, egoType) {
  const factory = egoType === "weapon" ? makeEgoWeaponItem : makeEgoArmorItem;
  extractEgo(state, abnormalityId, egoType, factory);
  renderAll();
}

function openCombatSetup(abnormalityOrTrial) {
  combatSession = {
    started: false,
    enemyRef: abnormalityOrTrial,
    enemyName: abnormalityOrTrial.name,
    enemyRank: abnormalityOrTrial.rank,
  };
  renderAll();
}

function handleAssignAndStart(staffIds) {
  const enemyRef = combatSession.enemyRef;
  const assigned = staffIds.map((id) => state.staffList.find((s) => s.id === id)).filter(Boolean);
  const session = createCombatSession(enemyRef, assigned, enemyRef.isTrial ? "trial" : "breach");
  session.started = true;
  combatSession = session;
  renderAll();

  combatTimer = setInterval(() => {
    tickCombat(combatSession, enemyRef, state.staffList);
    checkGameOver();
    if (combatSession.finished) {
      clearInterval(combatTimer);
      combatTimer = null;
      if (combatSession.result === "win" && !enemyRef.isTrial) {
        const ab = state.abnormalities.find((a) => a.id === enemyRef.id);
        if (ab) {
          ab.breached = false;
          ab.mood = Math.round(ab.maxMood * 0.5);
          ab.qliphoth = ab.qliphothMax;
        }
        state.pendingBreach = null;
        log(state, `${enemyRef.name} を再収容した。`);
      } else if (combatSession.result === "win" && enemyRef.isTrial) {
        log(state, `試練を突破した！`);
      } else {
        log(state, `鎮圧に失敗した…`);
      }
    }
    renderAll();
  }, COMBAT_TICK_MS);

  renderAll();
}

function handleCloseCombat() {
  combatSession = null;
  renderAll();
}

function handleEndDayClick() {
  if (!isQuotaMet(state)) return;
  candidateChoices = drawNextCandidates(state, 3);
  renderAll();
}

function handleChooseCandidate(id) {
  endDay(state, id);
  candidateChoices = null;
  renderAll();
}

function handleHireStaff() {
  if (state.staffList.length >= 12) {
    log(state, "これ以上職員を雇用できない（上限12名）。");
    renderAll();
    return;
  }
  const s = createStaff();
  state.staffList.push(s);
  log(state, `${s.name} を採用した。`);
  renderAll();
}

// ───────── リアルタイムティック ─────────

function startTimers() {
  qliphothTimer = setInterval(() => {
    if (state.gameOver || state.cleared || combatSession) return;
    tickQliphoth(state);
    const breachedNow = state.abnormalities.find((a) => a.breached && !combatSession);
    if (breachedNow && !combatSession) {
      openCombatSetup(breachedNow);
    }
    checkGameOver();
    renderAll();
  }, QLIPHOTH_TICK_MS);

  trialTimer = setInterval(() => {
    if (state.gameOver || state.cleared || combatSession) return;
    const enemy = createTrialEnemy(state.day);
    enemy.isTrial = true;
    log(state, `🔔 試練が発生：${enemy.name}`);
    openCombatSetup(enemy);
    renderAll();
  }, TRIAL_INTERVAL_MS);
}

// ───────── 初期化 ─────────

function init() {
  // 初期職員3名
  for (let i = 0; i < 3; i++) {
    state.staffList.push(createStaff());
  }
  log(state, "ロボトミー社 施設運営を開始した。");

  document.getElementById("end-day-btn").onclick = handleEndDayClick;
  document.getElementById("hire-btn").onclick = handleHireStaff;

  startTimers();
  renderAll();
}

init();
