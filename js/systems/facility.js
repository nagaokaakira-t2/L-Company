// ============================================================
// facility.js
// 施設運営のコアロジック: 作業判定 / 機嫌 / クリフォト暴走 / デイリーサイクル
// ============================================================

import { grantWorkExperience, restStaff, getArmorRank, getArmorResistance } from "../data/staff.js";
import { ABNORMALITY_POOL, instantiateAbnormality, getPeBoxConfig } from "../data/abnormalities.js";
import { calcAbnormalityToStaffDamage, RANK_VALUE } from "./damage.js";
import { unlockCost, egoExtractCost, egoMaxCount } from "../data/ego.js";

export const BASE_QUOTA = 30;
export const QUOTA_GROWTH_PER_DAY = 45; // 日を跨ぐごとの増加量（後半は選定される幻想体の数でさらに加速する）
export const FINAL_DAY = 50;
export const WORK_COOLDOWN_MS = 4000; // 1回作業した職員が次に作業できるまでのクールタイム(CT)
export const AB_WORK_COOLDOWN_MS = 4000; // 1回作業を受けた幻想体が次に作業を受けられるまでのCT

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createInitialState() {
  const state = {
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
    dayStartSnapshot: null, // 時間遡行技術用: その日の開始時点の状態
  };
  return state;
}

/**
 * その日の開始時点の状態を丸ごとスナップショットする（時間遡行技術用）。
 * staffListを初期投入した直後や、endDay完了直後に呼び出す。
 */
export function snapshotDayStart(state) {
  state.dayStartSnapshot = {
    energy: state.energy,
    staffList: JSON.parse(JSON.stringify(state.staffList)),
    abnormalities: JSON.parse(JSON.stringify(state.abnormalities)),
  };
}

/**
 * 時間遡行技術: その日の開始時点まで状態を巻き戻す。
 * 職員の負傷・死亡・精神崩壊、幻想体の機嫌/クリフォト/暴走状態などが全て復元される
 * （既知の観測情報や抽出済みE.G.O自体は失われない — スナップショット自体に含まれているため）。
 * その日中に新しく雇用した職員は失われる。
 */
export function rewindDay(state) {
  if (!state.dayStartSnapshot) return false;
  state.energy = state.dayStartSnapshot.energy;
  state.staffList = JSON.parse(JSON.stringify(state.dayStartSnapshot.staffList));
  state.abnormalities = JSON.parse(JSON.stringify(state.dayStartSnapshot.abnormalities));
  state.pendingBreach = null;
  state.gameOver = false;
  log(state, `時間遡行技術を発動。${state.day}日目の開始時点まで状態を巻き戻した。`);
  return true;
}

export function log(state, message) {
  state.log.unshift(`[${state.day}日目] ${message}`);
  if (state.log.length > 200) state.log.pop();
}

/**
 * 1件の作業を実行する（職員1名 -> 幻想体1体）
 * 作業結果は PE Box 判定により GOOD / NORMAL / BAD の3段階で評価され、
 * クリフォトカウンターの増減量は幻想体ごとの設定（getPeBoxConfig）に従う。
 * @returns {{ quality:string, success:boolean, energyGained:number, moodDelta:number }}
 */
export function performWork(state, staffId, abnormalityId, workType, now = Date.now()) {
  const staff = state.staffList.find((s) => s.id === staffId);
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (!staff || !ab || !staff.alive || !staff.sane) {
    return { quality: "NONE", success: false, energyGained: 0, moodDelta: 0 };
  }
  if (ab.breached) {
    return { quality: "NONE", success: false, energyGained: 0, moodDelta: 0 };
  }
  if (staff.workCooldownUntil && now < staff.workCooldownUntil) {
    return { quality: "NONE", success: false, energyGained: 0, moodDelta: 0, onCooldown: true, ctTarget: "staff" };
  }
  if (ab.workCooldownUntil && now < ab.workCooldownUntil) {
    return { quality: "NONE", success: false, energyGained: 0, moodDelta: 0, onCooldown: true, ctTarget: "abnormality" };
  }

  const rankValue = RANK_VALUE[ab.rank];

  // ── PE Box判定: 好み作業なら判定ロールが上振れ、苦手作業なら下振れする ──
  const roll = Math.random();
  let adjustedRoll = roll;
  if (workType === ab.preferredWork) adjustedRoll += 0.15;
  if (workType === ab.dislikedWork) adjustedRoll -= 0.15;
  const peCfg = getPeBoxConfig(ab);
  let quality = "NORMAL";
  if (adjustedRoll >= peCfg.goodThreshold) quality = "GOOD";
  else if (adjustedRoll < peCfg.badThreshold) quality = "BAD";

  const success = quality !== "BAD"; // GOOD/NORMALは成功扱い、BADのみ失敗扱い（成長・負傷判定用）
  const leveledUp = grantWorkExperience(staff, workType, success, rankValue);
  staff.workCooldownUntil = now + WORK_COOLDOWN_MS;
  ab.workCooldownUntil = now + AB_WORK_COOLDOWN_MS;

  let energyGained = 0;
  let moodDelta = 0;
  let qliphothDelta = 0;
  let infoGain = 0;
  let specialEffect = "";

  if (quality === "GOOD") {
    energyGained = 4 + Math.floor(Math.random() * 3) + rankValue;
    moodDelta = workType === ab.preferredWork ? 12 : 6;
    qliphothDelta = peCfg.goodQliphothBonus;
    infoGain = rankValue + 1;
    if (Math.random() < 0.25) {
      infoGain += 1;
      specialEffect = "／特殊効果: 追加の観測情報を得た";
    }
  } else if (quality === "BAD") {
    energyGained = 1;
    moodDelta = workType === ab.dislikedWork ? -18 : -8;
    qliphothDelta = -peCfg.badQliphothPenalty;
    infoGain = 0;
    if (Math.random() < 0.25) {
      moodDelta -= 6;
      specialEffect = "／特殊効果: 反発が強まり機嫌がさらに悪化した";
    }
  } else {
    energyGained = 3 + Math.floor(Math.random() * 3) + Math.floor(rankValue / 2);
    moodDelta = workType === ab.preferredWork ? 6 : workType === ab.dislikedWork ? -10 : 2;
    qliphothDelta = 1;
    infoGain = rankValue;
  }

  ab.mood = clamp(ab.mood + moodDelta, 0, ab.maxMood);
  ab.qliphoth = clamp(ab.qliphoth + qliphothDelta, 0, ab.qliphothMax);
  ab.infoPoints += infoGain;
  state.energy += energyGained;

  // ── 作業ダメージ: 結果が悪いほど、ランクが高いほど負傷リスクが上がる ──
  const injuryChance =
    quality === "BAD" ? 0.4 + rankValue * 0.05 : quality === "GOOD" ? 0.05 + rankValue * 0.01 : 0.15 + rankValue * 0.02;
  let staffDamageText = "";
  if (Math.random() < injuryChance) {
    const baseDamage = ab.baseAttack * (quality === "BAD" ? 0.55 : quality === "GOOD" ? 0.15 : 0.3);
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

  const qualityLabel = { GOOD: "良好", NORMAL: "普通", BAD: "不良" }[quality];
  log(
    state,
    `${staff.name} が ${ab.name} に対して作業(${workType})。結果: ${qualityLabel}。` +
      `機嫌${moodDelta >= 0 ? "+" : ""}${moodDelta} / クリフォト${qliphothDelta >= 0 ? "+" : ""}${qliphothDelta} / エネルギー+${energyGained}${leveledUp ? ` / ${staff.name} レベルアップ!` : ""}${staffDamageText}${specialEffect}`
  );

  if (ab.mood <= 0 && !ab.breached) {
    triggerBreach(state, ab);
  } else if (ab.qliphoth <= 0 && !ab.breached) {
    triggerBreach(state, ab);
  }

  return { quality, success, energyGained, moodDelta };
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
 * 武器と防具は別枠でカウントされ、それぞれランクに応じた上限まで独立に抽出できる
 * （例: WAW級なら武器4個・防具4個を、合計8個まで抽出可能）
 */
export function extractEgo(state, abnormalityId, egoType, itemFactory) {
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (!ab) return { ok: false, reason: "not_found" };
  if (!ab.unlockedInfo.manual) return { ok: false, reason: "manual_required" };

  const countKey = egoType === "weapon" ? "egoExtractedWeaponCount" : "egoExtractedArmorCount";
  const max = egoMaxCount(ab.rank);
  ab[countKey] = ab[countKey] || 0;
  if (ab[countKey] >= max) return { ok: false, reason: "max_reached" };

  const cost = egoExtractCost(ab.rank);
  if (ab.infoPoints < cost) return { ok: false, reason: "insufficient_points" };

  ab.infoPoints -= cost;
  ab[countKey] += 1;
  const item = itemFactory(ab);
  state.egoInventory.push(item);
  log(
    state,
    `${ab.name} から ${item.name} を抽出した（情報P -${cost} / この幻想体の${egoType === "weapon" ? "武器" : "防具"}残り抽出可能: ${max - ab[countKey]}）。`
  );
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
 * WAW/ALEPH級は15日目以降にのみ候補に出現する
 */
export function drawNextCandidates(state, count = 3) {
  const ownedIds = new Set(state.abnormalities.map((a) => a.id));
  let pool = ABNORMALITY_POOL.filter((a) => !ownedIds.has(a.id));
  if (state.day < 15) {
    pool = pool.filter((a) => a.rank !== "WAW" && a.rank !== "ALEPH");
  }
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
  snapshotDayStart(state);
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
