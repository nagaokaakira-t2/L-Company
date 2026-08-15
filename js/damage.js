// ============================================================
// damage.js
// 属性ダメージ計算・危険度ランク補正システム
// 設計資料の「ダメージ計算の要」セクションに準拠
// ============================================================

// 危険度ランク -> 数値
export const RANK_VALUE = {
  ZAYIN: 1,
  TETH: 2,
  HE: 3,
  WAW: 4,
  ALEPH: 5,
};

export const RANK_ORDER = ["ZAYIN", "TETH", "HE", "WAW", "ALEPH"];

export const DAMAGE_TYPES = ["RED", "WHITE", "BLACK", "PALE"];

/**
 * 被ダメージ倍率（防御側視点）
 * diff = 防御側ランク値 - 攻撃側ランク値
 * 資料の表に基づく参照テーブル（-4〜+4の範囲で線形補間せず、表の値をそのまま採用）
 */
const DEFENSE_TABLE = {
  4: 0.4,
  3: 0.6,
  2: 0.7,
  1: 0.8,
  0: 1.0,
  "-1": 1.0,
  "-2": 1.2,
  "-3": 1.5,
  "-4": 2.0,
};

/**
 * 与ダメージ倍率（攻撃側視点：武器ランク vs 対象ランク）
 * 資料には両端（同格1.0倍 / 4差で0.4倍・1.5倍）のみ明記されているため、
 * 間の値は攻撃側に有利な緩やかな逓減・逓増として近似している。
 * NOTE: バランス調整時はここを最初に見直すこと。
 */
const OFFENSE_TABLE = {
  4: 1.5,
  3: 1.35,
  2: 1.2,
  1: 1.1,
  0: 1.0,
  "-1": 0.9,
  "-2": 0.8,
  "-3": 0.6,
  "-4": 0.4,
};

function clampDiff(diff) {
  return Math.max(-4, Math.min(4, diff));
}

/**
 * 被ダメージ倍率を取得する
 * @param {string} defenderRank 防御側（防具/耐性側）のランク
 * @param {string} attackerRank 攻撃側のランク
 */
export function getDefenseMultiplier(defenderRank, attackerRank) {
  const diff = clampDiff(RANK_VALUE[defenderRank] - RANK_VALUE[attackerRank]);
  return DEFENSE_TABLE[diff];
}

/**
 * 与ダメージ倍率を取得する
 * @param {string} weaponRank 攻撃側（武器）のランク
 * @param {string} targetRank 対象（幻想体）のランク
 */
export function getOffenseMultiplier(weaponRank, targetRank) {
  const diff = clampDiff(RANK_VALUE[weaponRank] - RANK_VALUE[targetRank]);
  return OFFENSE_TABLE[diff];
}

/**
 * 属性耐性倍率の解釈:
 *  <= 0.0  : 吸収・無効化 (0扱い。マイナスなら回復にもできるが既定では0)
 *  0.1〜0.9: 抵抗
 *  1.0     : 通常
 *  >=1.1   : 弱点
 */
export function applyResistance(baseDamage, resistanceValue) {
  if (resistanceValue <= 0) return 0;
  return baseDamage * resistanceValue;
}

/**
 * 幻想体 -> 職員 への攻撃ダメージを計算
 * @param {object} params
 *   baseDamage: number
 *   damageType: 'RED'|'WHITE'|'BLACK'|'PALE'
 *   attackerRank: 幻想体のランク
 *   defenderArmorRank: 職員が装備する防具のランク（未装備は 'ZAYIN' 扱い）
 *   defenderResistance: { RED,WHITE,BLACK,PALE } 防具側の属性耐性値
 * @returns {{ hpDamage:number, spDamage:number, pale:boolean }}
 */
export function calcAbnormalityToStaffDamage({
  baseDamage,
  damageType,
  attackerRank,
  defenderArmorRank,
  defenderResistance,
}) {
  const resist = defenderResistance?.[damageType] ?? 1.0;
  const afterResist = applyResistance(baseDamage, resist);
  const rankMult = getDefenseMultiplier(defenderArmorRank, attackerRank);
  const finalDamage = afterResist * rankMult;

  const result = { hpDamage: 0, spDamage: 0, pale: false };
  switch (damageType) {
    case "RED":
      result.hpDamage = finalDamage;
      break;
    case "WHITE":
      result.spDamage = finalDamage;
      break;
    case "BLACK":
      result.hpDamage = finalDamage;
      result.spDamage = finalDamage;
      break;
    case "PALE":
      result.pale = true;
      result.hpDamage = finalDamage; // 呼び出し側で maxHP割合として再解釈する
      break;
  }
  return result;
}

/**
 * 職員 -> 幻想体 への攻撃ダメージを計算
 * @param {object} params
 *   baseDamage: number
 *   damageType: 'RED'|'WHITE'|'BLACK'|'PALE'
 *   weaponRank: 職員が装備する武器のランク
 *   targetRank: 対象の幻想体ランク
 *   targetResistance: 幻想体側の属性耐性値
 */
export function calcStaffToAbnormalityDamage({
  baseDamage,
  damageType,
  weaponRank,
  targetRank,
  targetResistance,
}) {
  const resist = targetResistance?.[damageType] ?? 1.0;
  const afterResist = applyResistance(baseDamage, resist);
  const rankMult = getOffenseMultiplier(weaponRank, targetRank);
  return afterResist * rankMult;
}

export function rankIndex(rank) {
  return RANK_ORDER.indexOf(rank);
}
