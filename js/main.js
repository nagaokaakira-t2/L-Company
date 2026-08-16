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
import {
  createCombatSession,
  tickCombat,
  trialWaveRanks,
  createTrialWaveEnemy,
  COMBAT_TICK_MS,
} from "./systems/combat.js";
import { makeEgoWeaponItem, makeEgoArmorItem } from "./data/ego.js";
import {
  renderHeader,
  renderLog,
  renderAbnormalities,
  renderStaff,
  renderDetailModal,
  renderCombatModal,
  renderCandidateModal,
  renderDayEndScreen,
  renderGameOverBanner,
} from "./ui/render.js";

const QLIPHOTH_TICK_MS = 9000; // クリフォトが1つ減るリアルタイム間隔（余裕を持たせた値）
const TRIAL_INTERVAL_MS = 75000; // 試練が発生するリアルタイム間隔
const REGEN_TICK_MS = 4000; // 未作業時のHP/SP自然回復間隔

let state = createInitialState();
let combatSession = null;
let combatTimer = null;
let candidateChoices = null;
let detailAbnormalityId = null;
let qliphothTimer = null;
let trialTimer = null;
let regenTimer = null;
let uiSelection = {}; // { [abnormalityId]: { staff, work } } — 再描画をまたいで作業実行の選択を保持する
let expandedStaffIds = new Set(); // 職員パネルで展開中のID
let dayEndState = null; // null | { mode: "normal" } | { mode: "recovery" }
let pendingCandidateId = null; // 1日終了時に選んだ次の管理対象（day-end画面を経てendDayに渡す）

// 試練（複数波）の進行管理
let trialQueue = null; // 残りウェーブのランク配列
let trialWaveNum = 0;
let trialWaveTotalNum = 0;

function isPaused() {
  return state.gameOver || state.cleared || !!dayEndState;
}

function checkGameOver() {
  const anyUsable = state.staffList.some((s) => s.alive && s.sane);
  if (state.staffList.length > 0 && !anyUsable && !state.gameOver) {
    state.gameOver = true;
    dayEndState = { mode: "recovery" };
    if (combatTimer) {
      clearInterval(combatTimer);
      combatTimer = null;
    }
    combatSession = null;
    trialQueue = null;
  }
}

function renderAll() {
  renderHeader(state);
  renderLog(state);
  renderAbnormalities(state, {
    onWork: handleWork,
    onOpenDetail: handleOpenDetail,
    selection: uiSelection,
    onSelectionChange: handleSelectionChange,
  });
  renderStaff(state, {
    onEquipWeapon: handleEquipWeapon,
    onEquipArmor: handleEquipArmor,
    expandedIds: expandedStaffIds,
    onToggleExpand: handleToggleStaffExpand,
  });
  renderDetailModal(state, detailAbnormalityId, {
    onUnlock: handleUnlock,
    onExtract: handleExtract,
    onClose: handleCloseDetail,
  });
  renderCombatModal(combatSession, state, { onAssignAndStart: handleAssignAndStart, onClose: handleCloseCombat });
  renderCandidateModal(candidateChoices, { onChoose: handleChooseCandidate });
  renderDayEndScreen(state, dayEndState, {
    onHire: handleDayEndHire,
    onRename: handleDayEndRename,
    onContinue: handleDayEndContinue,
  });
  renderGameOverBanner(state);
}

// ───────── イベントハンドラ ─────────

// 作業実行の職員/作業選択は再描画をまたいで保持する（handleWork等でrenderAll()が
// 呼ばれてもプルダウンの選択状態がリセットされないようにするため）
function handleSelectionChange(abnormalityId, field, value) {
  uiSelection[abnormalityId] = { ...uiSelection[abnormalityId], [field]: value };
  // DOM側は既にユーザー操作で更新済みのため、ここでは状態保持のみ行い re-render はしない
}

function handleToggleStaffExpand(staffId) {
  if (expandedStaffIds.has(staffId)) expandedStaffIds.delete(staffId);
  else expandedStaffIds.add(staffId);
  renderAll();
}

function handleWork(staffId, abnormalityId, workType) {
  if (isPaused()) return;
  const result = performWork(state, staffId, abnormalityId, workType);
  if (result.onCooldown) {
    renderAll();
    return;
  }
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
    waveNum: abnormalityOrTrial.isTrial ? trialWaveNum : undefined,
    waveTotal: abnormalityOrTrial.isTrial ? trialWaveTotalNum : undefined,
  };
  renderAll();
}

function startCombatWave(enemyRef, staffIds) {
  const assigned = staffIds
    .map((id) => state.staffList.find((s) => s.id === id))
    .filter((s) => s && s.alive && s.sane);

  if (assigned.length === 0) {
    log(state, `投入できる職員がいないため対応を中断した。`);
    combatSession = null;
    trialQueue = null;
    checkGameOver();
    renderAll();
    return;
  }

  const session = createCombatSession(enemyRef, assigned, enemyRef.isTrial ? "trial" : "breach");
  session.started = true;
  session.waveNum = enemyRef.isTrial ? trialWaveNum : undefined;
  session.waveTotal = enemyRef.isTrial ? trialWaveTotalNum : undefined;
  combatSession = session;
  renderAll();

  combatTimer = setInterval(() => {
    tickCombat(combatSession, enemyRef, state.staffList);
    checkGameOver();
    if (combatSession && combatSession.finished) {
      clearInterval(combatTimer);
      combatTimer = null;
      handleCombatResolved(enemyRef, staffIds);
    }
    renderAll();
  }, COMBAT_TICK_MS);
}

function handleCombatResolved(enemyRef, staffIds) {
  if (!combatSession) return;
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
    if (trialQueue && trialQueue.length > 0) {
      const nextRank = trialQueue.shift();
      trialWaveNum += 1;
      const nextEnemy = createTrialWaveEnemy(nextRank, state.day, trialWaveNum);
      log(state, `🔔 試練 第${trialWaveNum}波 発生: ${nextRank}`);
      startCombatWave(nextEnemy, staffIds);
      return;
    } else {
      log(state, `試練を完全に突破した！`);
      trialQueue = null;
    }
  } else {
    log(state, enemyRef.isTrial ? `試練への対応に失敗した…` : `鎮圧に失敗した…`);
    trialQueue = null;
  }
}

function handleAssignAndStart(staffIds) {
  const enemyRef = combatSession.enemyRef;
  startCombatWave(enemyRef, staffIds);
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
  pendingCandidateId = id;
  candidateChoices = null;
  dayEndState = { mode: "normal" };
  renderAll();
}

function handleDayEndHire() {
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

function handleDayEndRename(staffId, newName) {
  const s = state.staffList.find((x) => x.id === staffId);
  if (!s) return;
  const trimmed = newName.trim();
  if (trimmed) {
    s.name = trimmed.slice(0, 12);
  }
  renderAll();
}

function handleDayEndContinue() {
  if (dayEndState?.mode === "recovery") {
    state.gameOver = false;
    dayEndState = null;
    log(state, `職員体制を立て直し、${state.day}日目を再開する。`);
    renderAll();
    return;
  }
  endDay(state, pendingCandidateId);
  pendingCandidateId = null;
  dayEndState = null;
  renderAll();
}

function handleHireStaffBlocked() {
  log(state, "職員の雇用は「1日の終了」画面でのみ行える。");
  renderAll();
}

function handleToggleLog() {
  const box = document.getElementById("log-box");
  const btn = document.getElementById("log-toggle-btn");
  const collapsed = box.classList.toggle("collapsed");
  btn.textContent = collapsed ? "開く" : "閉じる";
}

function handleToggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

// ───────── リアルタイムティック ─────────

function startTimers() {
  qliphothTimer = setInterval(() => {
    if (isPaused() || combatSession) return;
    tickQliphoth(state);
    const breachedNow = state.abnormalities.find((a) => a.breached && !combatSession);
    if (breachedNow && !combatSession) {
      openCombatSetup(breachedNow);
    }
    checkGameOver();
    renderAll();
  }, QLIPHOTH_TICK_MS);

  trialTimer = setInterval(() => {
    if (isPaused() || combatSession) return;
    const ranks = trialWaveRanks(state.day);
    trialQueue = ranks.slice(1);
    trialWaveTotalNum = ranks.length;
    trialWaveNum = 1;
    const enemy = createTrialWaveEnemy(ranks[0], state.day, 1);
    log(state, `🔔 試練が発生（全${ranks.length}波）: 第1波 ${ranks[0]}`);
    openCombatSetup(enemy);
    renderAll();
  }, TRIAL_INTERVAL_MS);

  regenTimer = setInterval(() => {
    if (isPaused() || combatSession) return;
    let changed = false;
    for (const s of state.staffList) {
      if (!s.alive || !s.sane) continue;
      if (s.hp < s.maxHp) {
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.04);
        changed = true;
      }
      if (s.sp < s.maxSp) {
        s.sp = Math.min(s.maxSp, s.sp + s.maxSp * 0.04);
        changed = true;
      }
      if (s.panic && s.sp > s.maxSp * 0.5) {
        s.panic = false;
        changed = true;
      }
    }
    if (changed) renderAll();
  }, REGEN_TICK_MS);
}

// ───────── 初期化 ─────────

function init() {
  // 初期職員3名
  for (let i = 0; i < 3; i++) {
    state.staffList.push(createStaff());
  }
  log(state, "ロボトミー社 施設運営を開始した。");

  document.getElementById("end-day-btn").onclick = handleEndDayClick;
  document.getElementById("log-toggle-btn").onclick = handleToggleLog;
  document.getElementById("fullscreen-btn").onclick = handleToggleFullscreen;

  startTimers();
  renderAll();
}

init();
