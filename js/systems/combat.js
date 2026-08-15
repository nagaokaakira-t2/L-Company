// ============================================================
// combat.js
// 鎮圧戦闘 / 試練（トライアル）システム
// 本格的なRTSのユニット移動は行わず、「配置した職員が自動的に交戦する」
// リアルタイム進行のRTS-liteとして実装する（ティックごとに双方が攻撃）
// ============================================================

import {
  calcAbnormalityToStaffDamage,
  calcStaffToAbnormalityDamage,
} from "./damage.js";
import { getWeaponRank, getArmorRank, getArmorResistance } from "../data/staff.js";

export const COMBAT_TICK_MS = 800; // 1ティックの間隔（リアルタイム感を出すための擬似RTS速度）

/**
 * 戦闘インスタンスを生成する
 * @param {object} abnormality 暴走中の幻想体インスタンス
 * @param {object[]} assignedStaff 鎮圧に投入する職員配列
 * @param {"breach"|"trial"} kind
 */
export function createCombatSession(abnormality, assignedStaff, kind = "breach") {
  return {
    kind,
    abnormalityId: abnormality.id,
    enemyName: abnormality.name,
    enemyRank: abnormality.rank,
    enemyHp: abnormality.baseAttack * 6, // 簡易HP: 攻撃力に比例させる
    enemyMaxHp: abnormality.baseAttack * 6,
    enemyResistance: abnormality.resistance,
    enemyDamageType: abnormality.damageType,
    staffIds: assignedStaff.map((s) => s.id),
    tickCount: 0,
    finished: false,
    result: null, // "win" | "lose"
    combatLog: [],
  };
}

function pushLog(session, msg) {
  session.combatLog.unshift(msg);
  if (session.combatLog.length > 100) session.combatLog.pop();
}

/**
 * 戦闘を1ティック進める。呼び出し側が setInterval 等で定期的に呼ぶ想定。
 * @param {object} session createCombatSessionの戻り値
 * @param {object} abnormalityLike enemyRank/damageType等を持つ幻想体オブジェクト
 * @param {object[]} staffList 全職員配列（IDで参照する）
 */
export function tickCombat(session, abnormalityLike, staffList) {
  if (session.finished) return session;
  session.tickCount += 1;

  const combatants = session.staffIds
    .map((id) => staffList.find((s) => s.id === id))
    .filter((s) => s && s.alive && s.sane && s.hp > 0);

  if (combatants.length === 0) {
    session.finished = true;
    session.result = "lose";
    pushLog(session, `鎮圧部隊が全滅した。`);
    return session;
  }

  // 職員 -> 幻想体
  for (const staff of combatants) {
    const weaponRank = getWeaponRank(staff);
    const weaponPower = staff.equippedWeapon?.power ?? 6;
    const dmg = calcStaffToAbnormalityDamage({
      baseDamage: weaponPower,
      damageType: staff.equippedWeapon?.damageType ?? "RED",
      weaponRank,
      targetRank: session.enemyRank,
      targetResistance: session.enemyResistance,
    });
    session.enemyHp = Math.max(0, session.enemyHp - dmg);
    pushLog(session, `${staff.name} の攻撃！ ${session.enemyName} に ${dmg.toFixed(1)} ダメージ`);
  }

  if (session.enemyHp <= 0) {
    session.finished = true;
    session.result = "win";
    pushLog(session, `${session.enemyName} を鎮圧した！`);
    return session;
  }

  // 幻想体 -> 職員（生存者からランダムに1〜2名を狙う）
  const targetCount = Math.min(combatants.length, session.enemyRank === "ALEPH" ? 2 : 1);
  const shuffled = [...combatants].sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, targetCount);

  for (const staff of targets) {
    const baseDamage = abnormalityLike.baseAttack * (0.8 + Math.random() * 0.4);
    const result = calcAbnormalityToStaffDamage({
      baseDamage,
      damageType: session.enemyDamageType,
      attackerRank: session.enemyRank,
      defenderArmorRank: getArmorRank(staff),
      defenderResistance: getArmorResistance(staff),
    });

    if (result.pale) {
      const paleDamage = staff.maxHp * Math.min(0.5, result.hpDamage / 100);
      staff.hp = Math.max(0, staff.hp - paleDamage);
      pushLog(session, `${staff.name} は割合ダメージを受けた！ (-${paleDamage.toFixed(1)} HP)`);
    } else {
      if (result.hpDamage > 0) staff.hp = Math.max(0, staff.hp - result.hpDamage);
      if (result.spDamage > 0) staff.sp = Math.max(0, staff.sp - result.spDamage);
      pushLog(
        session,
        `${session.enemyName} の攻撃！ ${staff.name} に HP-${result.hpDamage.toFixed(1)} SP-${result.spDamage.toFixed(1)}`
      );
    }

    if (staff.sp <= 0 && !staff.panic) {
      staff.panic = true;
      pushLog(session, `${staff.name} はパニック状態に陥った！`);
    }
    if (staff.hp <= 0) {
      staff.alive = false;
      pushLog(session, `${staff.name} が戦線離脱した…`);
    }
  }

  return session;
}

/**
 * 試練（Trial）: 一定日数ごとに発生する不明な敵の襲撃。
 * 鎮圧戦闘と同じロジックを再利用しつつ、専用の敵ステータスを生成する。
 */
export function createTrialEnemy(day) {
  const scaledRankIdx = Math.min(4, Math.floor(day / 10));
  const ranks = ["ZAYIN", "TETH", "HE", "WAW", "ALEPH"];
  const rank = ranks[scaledRankIdx];
  const rankMultiplier = 1 + scaledRankIdx * 0.6;
  return {
    id: `trial_day_${day}`,
    name: `試練の侵入者（${day}日目）`,
    rank,
    baseAttack: Math.round(15 * rankMultiplier),
    damageType: ["RED", "WHITE", "BLACK", "PALE"][Math.floor(Math.random() * 4)],
    resistance: { RED: 0.9, WHITE: 0.9, BLACK: 0.9, PALE: 0.9 },
  };
}
