// ============================================================
// main.js
// エントリーポイント: 状態管理・仮想クロック（一時停止/倍速対応）・イベント配線
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
  rewindDay,
  snapshotDayStart,
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
  renderFacilityMap,
  renderRoomAssignModal,
  renderStaff,
  renderDetailModal,
  renderCombatModal,
  renderCandidateModal,
  renderDayEndScreen,
  renderCodexModal,
  renderGameOverBanner,
} from "./ui/render.js";

const QLIPHOTH_TICK_MS = 9000; // クリフォトが1つ減る（仮想時間の）間隔
const TRIAL_INTERVAL_MS = 75000; // 試練が発生する（仮想時間の）間隔
const REGEN_TICK_MS = 4000; // 未作業時のHP/SP自然回復間隔
const REAL_TICK_MS = 200; // マスタークロックの実時間刻み幅

let state = createInitialState();
let combatSession = null;
let candidateChoices = null;
let detailAbnormalityId = null;
let codexOpen = false;
let uiSelection = {}; // { [abnormalityId]: { staff, work } } — 再描画をまたいで作業実行の選択を保持する
let expandedStaffIds = new Set(); // 職員パネルで展開中のID
let dayEndState = null; // null | { mode: "normal" } | { mode: "recovery" } | { mode: "rewind" }
let pendingCandidateId = null; // 1日終了時に選んだ次の管理対象（day-end画面を経てendDayに渡す）
let roomAssignAbnormalityId = null; // 収容室クリックで開いている作業割り当てモーダルの対象

// ── WASD施設探索カメラ ──
let camX = 0;
let camY = 0;
const CAM_SPEED = 7; // px / real frame
const pressedKeys = new Set();

// 試練（複数波）の進行管理
let trialQueue = null; // 残りウェーブのランク配列
let trialWaveNum = 0;
let trialWaveTotalNum = 0;

// ── 仮想クロック（一時停止・倍速対応） ──
let virtualNow = Date.now();
let gameSpeed = 1; // 0=一時停止, 1, 2, 4
let qliphothAcc = 0;
let trialAcc = 0;
let regenAcc = 0;
let combatAcc = 0;
let ctRefreshAcc = 0; // CT（クールタイム）表示を古いまま放置しないための軽量リフレッシュ用
const CT_REFRESH_MS = 2500; // 短すぎるとプルダウン操作中に再描画が割り込みやすくなるため、余裕を持たせる
let masterTimer = null;

function isPaused() {
  return state.gameOver || state.cleared || !!dayEndState;
}

function checkGameOver() {
  const anyUsable = state.staffList.some((s) => s.alive && s.sane);
  if (state.staffList.length > 0 && !anyUsable && !state.gameOver) {
    state.gameOver = true;
    dayEndState = { mode: "recovery" };
    combatSession = null;
    trialQueue = null;
    combatAcc = 0;
  }
}

function renderAll() {
  renderHeader(state);
  renderLog(state);
  renderFacilityMap(state, {
    onOpenDetail: handleOpenDetail,
    onOpenAssign: handleOpenRoomAssign,
  });
  applyCameraTransform(); // 再構築でtransformが失われるため、内容再描画のたびにカメラ位置を再適用する
  renderRoomAssignModal(state, roomAssignAbnormalityId, {
    selection: uiSelection,
    onSelectionChange: handleSelectionChange,
    onWork: handleWork,
    onClose: handleCloseRoomAssign,
    now: virtualNow,
  });
  renderStaff(state, {
    onEquipWeapon: handleEquipWeapon,
    onEquipArmor: handleEquipArmor,
    expandedIds: expandedStaffIds,
    onToggleExpand: handleToggleStaffExpand,
    now: virtualNow,
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
    onCancel: handleDayEndCancel,
  });
  renderCodexModal(state, codexOpen, { onClose: handleCloseCodex });
  renderGameOverBanner(state);
}

// ───────── WASD施設探索カメラ ─────────

function applyCameraTransform() {
  const world = document.getElementById("facility-world");
  if (world) world.style.transform = `translate(${-camX}px, ${-camY}px)`;
}

function cameraLoop() {
  requestAnimationFrame(cameraLoop);
  if (pressedKeys.size === 0) return;
  // モーダルが開いている間やテキスト入力中はカメラを動かさない
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA")) return;

  let dx = 0;
  let dy = 0;
  if (pressedKeys.has("w")) dy -= CAM_SPEED;
  if (pressedKeys.has("s")) dy += CAM_SPEED;
  if (pressedKeys.has("a")) dx -= CAM_SPEED;
  if (pressedKeys.has("d")) dx += CAM_SPEED;
  if (dx === 0 && dy === 0) return;

  const viewport = document.getElementById("facility-viewport");
  const world = document.getElementById("facility-world");
  if (!viewport || !world) return;
  const maxX = Math.max(0, world.scrollWidth - viewport.clientWidth);
  const maxY = Math.max(0, world.scrollHeight - viewport.clientHeight);
  camX = Math.min(maxX, Math.max(0, camX + dx));
  camY = Math.min(maxY, Math.max(0, camY + dy));
  applyCameraTransform();
}

function setupWasdControls() {
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "w" || key === "a" || key === "s" || key === "d") {
      const active = document.activeElement;
      const typing = active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA");
      if (!typing) e.preventDefault();
      pressedKeys.add(key);
    }
  });
  window.addEventListener("keyup", (e) => {
    pressedKeys.delete(e.key.toLowerCase());
  });
  window.addEventListener("blur", () => pressedKeys.clear());
  requestAnimationFrame(cameraLoop);
}

// ───────── イベントハンドラ ─────────

function handleOpenRoomAssign(abnormalityId) {
  roomAssignAbnormalityId = abnormalityId;
  renderAll();
}

function handleCloseRoomAssign() {
  roomAssignAbnormalityId = null;
  renderAll();
}

function handleSelectionChange(abnormalityId, field, value) {
  uiSelection[abnormalityId] = { ...uiSelection[abnormalityId], [field]: value };
}

function handleToggleStaffExpand(staffId) {
  if (expandedStaffIds.has(staffId)) expandedStaffIds.delete(staffId);
  else expandedStaffIds.add(staffId);
  renderAll();
}

function handleWork(staffId, abnormalityId, workType) {
  if (isPaused()) return;
  const result = performWork(state, staffId, abnormalityId, workType, virtualNow);
  if (result.onCooldown) {
    renderAll();
    return;
  }
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (ab && ab.breached && !combatSession) {
    if (roomAssignAbnormalityId === abnormalityId) roomAssignAbnormalityId = null;
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

function handleOpenCodex() {
  codexOpen = true;
  renderAll();
}

function handleCloseCodex() {
  codexOpen = false;
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
  session._enemyRef = enemyRef;
  session._staffIds = staffIds;
  combatSession = session;
  combatAcc = 0;
  renderAll();
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
  if (dayEndState?.mode === "rewind") {
    rewindDay(state);
    dayEndState = null;
    combatSession = null;
    trialQueue = null;
    renderAll();
    return;
  }
  endDay(state, pendingCandidateId);
  pendingCandidateId = null;
  dayEndState = null;
  renderAll();
}

function handleDayEndCancel() {
  if (dayEndState?.mode === "rewind") {
    dayEndState = null;
    renderAll();
  }
}

function handleRewindClick() {
  if (state.gameOver || state.cleared) return;
  dayEndState = { mode: "rewind" };
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

function handleSetSpeed(speed) {
  gameSpeed = speed;
  for (const [id, s] of [
    ["speed-pause-btn", 0],
    ["speed-1x-btn", 1],
    ["speed-2x-btn", 2],
    ["speed-4x-btn", 4],
  ]) {
    document.getElementById(id).classList.toggle("active", s === speed);
  }
}

// ───────── マスタークロック（一時停止・倍速に応じて仮想時間を進める） ─────────

function doQliphothTick() {
  tickQliphoth(state);
  const breachedNow = state.abnormalities.find((a) => a.breached && !combatSession);
  if (breachedNow && !combatSession) {
    openCombatSetup(breachedNow);
  }
  checkGameOver();
}

function doTrialTick() {
  state.trialTriggeredToday = true; // 試練は1日1回のみ。同日中は再発生させない
  const ranks = trialWaveRanks(state.day);
  trialQueue = ranks.slice(1);
  trialWaveTotalNum = ranks.length;
  trialWaveNum = 1;
  const enemy = createTrialWaveEnemy(ranks[0], state.day, 1);
  log(state, `🔔 試練が発生（全${ranks.length}波）: 第1波 ${ranks[0]}`);
  openCombatSetup(enemy);
}

function doRegenTick() {
  for (const s of state.staffList) {
    if (!s.alive || !s.sane) continue;
    if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.04);
    if (s.sp < s.maxSp) s.sp = Math.min(s.maxSp, s.sp + s.maxSp * 0.04);
    if (s.panic && s.sp > s.maxSp * 0.5) s.panic = false;
  }
}

function masterTick() {
  if (gameSpeed === 0) return; // 一時停止中は仮想時間を進めない
  const delta = REAL_TICK_MS * gameSpeed;
  virtualNow += delta;

  if (isPaused()) return;

  if (!combatSession) {
    qliphothAcc += delta;
    trialAcc += delta;
    regenAcc += delta;
    ctRefreshAcc += delta;
    let changed = false;
    if (qliphothAcc >= QLIPHOTH_TICK_MS) {
      qliphothAcc -= QLIPHOTH_TICK_MS;
      doQliphothTick();
      changed = true;
    }
    if (!combatSession && !state.trialTriggeredToday && trialAcc >= TRIAL_INTERVAL_MS) {
      trialAcc -= TRIAL_INTERVAL_MS;
      doTrialTick();
      changed = true;
    }
    if (regenAcc >= REGEN_TICK_MS) {
      regenAcc -= REGEN_TICK_MS;
      doRegenTick();
      changed = true;
    }
    if (ctRefreshAcc >= CT_REFRESH_MS) {
      ctRefreshAcc -= CT_REFRESH_MS;
      // CT表示を1秒に1回だけ強制的に更新する。0.2秒ごとの全再描画は
      // プルダウンを開こうとした瞬間に閉じてしまう原因になるため避けつつ、
      // CTが切れた後もボタンが無効なまま放置されることのないようにする。
      changed = true;
    }
    // 何かが実際に変化した時だけ再描画する。毎ティック無条件に描画すると、
    // 職員/作業のプルダウンを開こうとした瞬間にDOMごと作り直されて
    // 選択メニューが閉じてしまう（「一瞬表示されてすぐ消える」）問題が起きるため。
    if (changed) renderAll();
  } else if (combatSession.started && !combatSession.finished) {
    combatAcc += delta;
    while (combatAcc >= COMBAT_TICK_MS) {
      combatAcc -= COMBAT_TICK_MS;
      const enemyRef = combatSession._enemyRef;
      const staffIds = combatSession._staffIds;
      tickCombat(combatSession, enemyRef, state.staffList);
      checkGameOver();
      if (!combatSession) break;
      if (combatSession.finished) {
        handleCombatResolved(enemyRef, staffIds);
        combatAcc = 0;
        break;
      }
    }
    renderAll();
  }
}

// ───────── 初期化 ─────────

function init() {
  // 初期職員3名
  for (let i = 0; i < 3; i++) {
    state.staffList.push(createStaff());
  }
  log(state, "ロボトミー社 施設運営を開始した。");
  snapshotDayStart(state);

  document.getElementById("end-day-btn").onclick = handleEndDayClick;
  document.getElementById("log-toggle-btn").onclick = handleToggleLog;
  document.getElementById("fullscreen-btn").onclick = handleToggleFullscreen;
  document.getElementById("rewind-btn").onclick = handleRewindClick;
  document.getElementById("codex-btn").onclick = handleOpenCodex;
  document.getElementById("speed-pause-btn").onclick = () => handleSetSpeed(0);
  document.getElementById("speed-1x-btn").onclick = () => handleSetSpeed(1);
  document.getElementById("speed-2x-btn").onclick = () => handleSetSpeed(2);
  document.getElementById("speed-4x-btn").onclick = () => handleSetSpeed(4);

  masterTimer = setInterval(masterTick, REAL_TICK_MS);
  setupWasdControls();
  renderAll();
}

init();
