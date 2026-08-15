// ============================================================
// facility.js
// 施設運営のコアロジック: 作業判定 / 機嫌 / クリフォト暴走 / デイリーサイクル
// ============================================================

import { grantWorkExperience, restStaff, getArmorRank, getArmorResistance } from "../data/staff.js";
import { ABNORMALITY_POOL, instantiateAbnormality } from "../data/abnormalities.js";
import { calcAbnormalityToStaffDamage, RANK_VALUE } from "./damage.js";
import { unlockCost, egoExtractCost, egoMaxCount } from "../data/ego.js";

export const BASE_QUOTA = 30;
export const QUOTA_GROWTH_PER_DAY = 45; // 日を跨ぐごとの増加量（後半は選定される幻想体の数でさらに加速する）
export const FINAL_DAY = 50;

export function createInitialState() {
  return {
    day: 1,
    energy: 0,
    quota: BASE_QUOTA,
    staffList: [],
    abnormalities: [
      instantiateAbnormality("silent_girl"),
      instantiateAbnormality("clock_eater"),
    ],
    log: [],
    gameOver: false,
    cleared: false,
    pendingBreach: null, // 戦闘に移行する幻想体
    checkpoints: [], // { day, snapshot } チェックポイント（巻き戻し用）
    egoInventory: [], // 抽出済みE.G.O装備（武器/防具）の実体リスト
  };
}

export function log(state, message) {
  state.log.unshift(`[${state.day}日目] ${message}`);
  if (state.log.length > 200) state.log.pop();
}

/**
 * 作業成功率: 好みの作業なら高確率、嫌いな作業なら低確率、
 * 職員のレベル・対応ステータスが高いほど補正される
 */
function calcSuccessChance(staff, abnormality, workType) {
  let base = 0.55;
  if (workType === abnormality.preferredWork) base += 0.25;
  if (workType === abnormality.dislikedWork) base -= 0.3;

  const statBoost = Math.min(0.2, (staff.level - 1) * 0.02);
  return Math.max(0.05, Math.min(0.95, base + statBoost));
}

/**
 * 1件の作業を実行する（職員1名 -> 幻想体1体）
 * @returns {{ success:boolean, energyGained:number, moodDelta:number }}
 */
export function performWork(state, staffId, abnormalityId, workType) {
  const staff = state.staffList.find((s) => s.id === staffId);
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (!staff || !ab || !staff.alive || !staff.sane) {
    return { success: false, energyGained: 0, moodDelta: 0 };
  }
  if (ab.breached) {
    return { success: false, energyGained: 0, moodDelta: 0 };
  }

  const rankValue = RANK_VALUE[ab.rank];
  const chance = calcSuccessChance(staff, ab, workType);
  const success = Math.random() < chance;
  const leveledUp = grantWorkExperience(staff, workType, success, rankValue);

  let energyGained = 0;
  let moodDelta = 0;

  if (success) {
    energyGained = (3 + Math.floor(Math.random() * 3)) + rankValue; // 高ランクほどエネルギー効率も良い
    moodDelta = workType === ab.preferredWork ? 8 : 3;
    ab.infoPoints += rankValue; // 情報ポイントもランクに比例（高ランクほど解禁コストが高い分、貯まりも早い）
    ab.qliphoth = Math.min(ab.qliphothMax, ab.qliphoth + 1);
  } else {
    energyGained = 1;
    moodDelta = workType === ab.dislikedWork ? -15 : -5;
  }

  ab.mood = Math.max(0, Math.min(ab.maxMood, ab.mood + moodDelta));
  state.energy += energyGained;

  // ── 作業ダメージ: ランクが高いほど、失敗時ほど負傷リスクが上がる ──
  const injuryChance = success ? 0.12 + rankValue * 0.02 : 0.4 + rankValue * 0.05;
  let staffDamageText = "";
  if (Math.random() < injuryChance) {
    const baseDamage = ab.baseAttack * (success ? 0.2 : 0.55);
    const dmg = calcAbnormalityToStaffDamage({
      baseDamage,
      damageType: ab.damageType,
      attackerRank: ab.rank,
      defenderArmorRank: getArmorRank(staff),
      defenderResistance: getArmorResistance(staff),
    });
    if (dmg.pale) {
      const paleDamage = staff.maxHp * Math.min(0.35, dmg.hpDamage / 100);
      staff.hp = Math.max(0, staff.hp - paleDamage);
      staffDamageText = ` / ${staff.name} 割合ダメージ-${paleDamage.toFixed(1)}HP`;
    } else {
      if (dmg.hpDamage > 0) staff.hp = Math.max(0, staff.hp - dmg.hpDamage);
      if (dmg.spDamage > 0) staff.sp = Math.max(0, staff.sp - dmg.spDamage);
      staffDamageText = ` / ${staff.name} HP-${dmg.hpDamage.toFixed(1)} SP-${dmg.spDamage.toFixed(1)}`;
    }
    if (staff.sp <= 0 && !staff.panic) {
      staff.panic = true;
      staffDamageText += `（パニック状態）`;
    }
    if (staff.hp <= 0 && staff.alive) {
      staff.alive = false;
      staffDamageText += `（${staff.name} 殉職）`;
    }
  }

  log(
    state,
    `${staff.name} が ${ab.name} に対して作業(${workType})${success ? "成功" : "失敗"}。` +
      `機嫌${moodDelta >= 0 ? "+" : ""}${moodDelta} / エネルギー+${energyGained}${leveledUp ? ` / ${staff.name} レベルアップ!` : ""}${staffDamageText}`
  );

  if (ab.mood <= 0 && !ab.breached) {
    triggerBreach(state, ab);
  }

  return { success, energyGained, moodDelta };
}

/**
 * 情報開示（名前 / マニュアル）: 蓄積した情報ポイントを消費して解禁する
 */
export function unlockAbnormalityInfo(state, abnormalityId, kind) {
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (!ab) return { ok: false, reason: "not_found" };
  if (ab.unlockedInfo[kind]) return { ok: false, reason: "already_unlocked" };
  if (kind === "manual" && !ab.unlockedInfo.name) return { ok: false, reason: "name_required" };

  const cost = unlockCost(ab.rank, kind);
  if (ab.infoPoints < cost) return { ok: false, reason: "insufficient_points" };

  ab.infoPoints -= cost;
  ab.unlockedInfo[kind] = true;
  log(state, `${ab.name} の${kind === "name" ? "名前" : "管理マニュアル"}を解禁した（情報P -${cost}）。`);
  return { ok: true, cost };
}

/**
 * E.G.O抽出: 情報ポイントを消費してインベントリに武器 or 防具を1点追加する
 */
export function extractEgo(state, abnormalityId, egoType, itemFactory) {
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (!ab) return { ok: false, reason: "not_found" };
  if (!ab.unlockedInfo.manual) return { ok: false, reason: "manual_required" };

  const max = egoMaxCount(ab.rank);
  ab.egoExtractedCount = ab.egoExtractedCount || 0;
  if (ab.egoExtractedCount >= max) return { ok: false, reason: "max_reached" };

  const cost = egoExtractCost(ab.rank);
  if (ab.infoPoints < cost) return { ok: false, reason: "insufficient_points" };

  ab.infoPoints -= cost;
  ab.egoExtractedCount += 1;
  const item = itemFactory(ab);
  state.egoInventory.push(item);
  log(state, `${ab.name} から ${item.name} を抽出した（情報P -${cost} / 残り抽出可能: ${max - ab.egoExtractedCount}）。`);
  return { ok: true, cost, item };
}

/**
 * 機嫌が0になった、またはクリフォトが尽きた際に暴走を発生させる
 */
export function triggerBreach(state, ab) {
  ab.breached = true;
  ab.contained = ab.breachType === "ability"; // 能力発動型は収容室内に留まる
  state.pendingBreach = ab.id;
  log(
    state,
    `⚠ ${ab.name} が制御を失った！（${ab.breachType === "escape" ? "脱走" : "能力発動"}）`
  );
}

/**
 * 時間経過（1ティック）: 未対応の幻想体のクリフォトを減らす
 */
export function tickQliphoth(state) {
  for (const ab of state.abnormalities) {
    if (ab.breached) continue;
    ab.qliphoth -= 1;
    if (ab.qliphoth <= 0) {
      triggerBreach(state, ab);
    }
  }
}

/**
 * その日のノルマ達成判定
 */
export function isQuotaMet(state) {
  return state.energy >= state.quota;
}

/**
 * 次の管理対象候補を3体提示する（未収容のものからランダム抽出）
 */
export function drawNextCandidates(state, count = 3) {
  const ownedIds = new Set(state.abnormalities.map((a) => a.id));
  const pool = ABNORMALITY_POOL.filter((a) => !ownedIds.has(a.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 1日を終了し、翌日へ進める
 */
export function endDay(state, chosenAbnormalityId) {
  if (chosenAbnormalityId) {
    state.abnormalities.push(instantiateAbnormality(chosenAbnormalityId));
    log(state, `新たな管理対象を選定した。`);
  }

  // チェックポイント保存（ループ攻略のための巻き戻しポイント）
  state.checkpoints.push({
    day: state.day,
    snapshot: JSON.parse(JSON.stringify({
      abnormalities: state.abnormalities.map((a) => ({
        id: a.id,
        unlockedInfo: a.unlockedInfo,
      })),
    })),
  });
  if (state.checkpoints.length > 10) state.checkpoints.shift();

  state.day += 1;
  state.energy = 0;
  state.quota = BASE_QUOTA + QUOTA_GROWTH_PER_DAY * (state.day - 1) +
    Math.floor(Math.pow(state.day, 1.55));

  for (const ab of state.abnormalities) {
    if (!ab.breached) ab.qliphoth = ab.qliphothMax;
  }
  for (const staff of state.staffList) {
    restStaff(staff);
  }

  if (state.day > FINAL_DAY) {
    state.cleared = true;
  }

  log(state, `${state.day}日目を迎えた。ノルマ: ${state.quota}`);
}

/**
 * 引き継ぎ付きで巻き戻す（怪物の知識=unlockedInfoは維持）
 */
export function rollbackToCheckpoint(state, checkpointIndex) {
  const cp = state.checkpoints[checkpointIndex];
  if (!cp) return state;
  const fresh = createInitialState();
  fresh.day = cp.day;
  // 解放済み情報だけ引き継ぐ
  for (const savedAb of cp.snapshot.abnormalities) {
    const target = fresh.abnormalities.find((a) => a.id === savedAb.id);
    if (target) target.unlockedInfo = savedAb.unlockedInfo;
  }
  fresh.checkpoints = state.checkpoints.slice(0, checkpointIndex + 1);
  log(fresh, `チェックポイント（${cp.day}日目）まで巻き戻した。獲得済みの知識は引き継がれる。`);
  return fresh;
}
