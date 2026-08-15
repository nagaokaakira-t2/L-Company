// ============================================================
// staff.js
// 職員の生成・育成（4ステータス: 勇気/慎重/自制/正義）
// ============================================================

let staffIdCounter = 1;

const FIRST_NAMES = ["アヤカ", "リョウ", "ミナト", "ハルカ", "ケイ", "ソラ", "ユズキ", "トウマ"];
const LAST_NAMES = ["白鳥", "黒井", "水無月", "東雲", "九条", "鏡", "灰原", "神楽"];

export const STAT_TYPES = ["COURAGE", "PRUDENCE", "SELF_CONTROL", "JUSTICE"];
export const STAT_LABEL = {
  COURAGE: "勇気",
  PRUDENCE: "慎重",
  SELF_CONTROL: "自制",
  JUSTICE: "正義",
};

// 作業タイプごとに主に伸びるステータス
export const WORK_TO_STAT = {
  INSTINCT: "COURAGE",
  INSIGHT: "PRUDENCE",
  ATTACHMENT: "JUSTICE",
  REPRESSION: "SELF_CONTROL",
};

function randomName() {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${l} ${f}`;
}

export function createStaff() {
  const id = `staff_${staffIdCounter++}`;
  return {
    id,
    name: randomName(),
    level: 1,
    stats: { COURAGE: 1, PRUDENCE: 1, SELF_CONTROL: 1, JUSTICE: 1 },
    hp: 40,
    maxHp: 40,
    sp: 40,
    maxSp: 40,
    panic: false,
    alive: true,
    sane: true, // false = 精神崩壊
    equippedWeapon: null, // { rank, damageType, power, name }
    equippedArmor: null, // { rank, resistance:{RED,WHITE,BLACK,PALE}, name }
    assignment: null, // 現在の作業先 abnormalityId
    exp: 0,
  };
}

export function statTotal(staff) {
  return Object.values(staff.stats).reduce((a, b) => a + b, 0);
}

/**
 * 作業成功時の経験値付与とレベルアップ処理
 * @param {number} rankValue 対象幻想体の危険度（ZAYIN=1〜ALEPH=5）。
 *   低ランクほど伸びが小さく、高ランクほど大きくなる（ハイリスク・ハイリターン）。
 */
export function grantWorkExperience(staff, workType, success, rankValue = 1) {
  const stat = WORK_TO_STAT[workType];
  const gain = success ? rankValue : Math.max(1, Math.ceil(rankValue / 2));
  staff.stats[stat] += gain;
  staff.exp += success ? rankValue * 8 : rankValue * 3;

  const nextLevelExp = staff.level * 40;
  if (staff.exp >= nextLevelExp) {
    staff.exp -= nextLevelExp;
    staff.level += 1;
    staff.maxHp += 5;
    staff.maxSp += 5;
    staff.hp = staff.maxHp;
    staff.sp = staff.maxSp;
    return true; // leveled up
  }
  return false;
}

/**
 * 日終了時の休養処理（HP/SP回復・パニック解除）
 */
export function restStaff(staff) {
  if (!staff.alive || !staff.sane) return;
  staff.hp = Math.min(staff.maxHp, staff.hp + staff.maxHp * 0.5);
  staff.sp = Math.min(staff.maxSp, staff.sp + staff.maxSp * 0.5);
  staff.panic = false;
}

/**
 * 職員の武器/防具ランク（未装備は最弱のZAYIN扱い）
 */
export function getWeaponRank(staff) {
  return staff.equippedWeapon?.rank ?? "ZAYIN";
}
export function getArmorRank(staff) {
  return staff.equippedArmor?.rank ?? "ZAYIN";
}
export function getArmorResistance(staff) {
  return staff.equippedArmor?.resistance ?? { RED: 1.0, WHITE: 1.0, BLACK: 1.0, PALE: 1.0 };
}
