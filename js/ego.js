// ============================================================
// ego.js
// E.G.O（幻想体から抽出する装備）
// ・情報開示（名前/マニュアル）、EGO抽出はいずれも「情報ポイント」を消費する
// ・コストと抽出可能上限数はランクが高いほど大きくなる
// ・抽出したアイテムは state.egoInventory に実体として追加される（在庫制）
// ============================================================

import { RANK_VALUE } from "../systems/damage.js";

const WEAPON_POWER_BY_RANK = { ZAYIN: 10, TETH: 16, HE: 24, WAW: 32, ALEPH: 48 };

let itemIdCounter = 1;

/**
 * 情報開示コスト（名前 / マニュアル）
 * 高ランクほど要求される作業ポイントが増える
 */
export function unlockCost(rank, kind) {
  const r = RANK_VALUE[rank];
  return kind === "name" ? r * 4 : r * 10;
}

/**
 * EGO抽出1回あたりのコスト（高ランクほど高い）
 */
export function egoExtractCost(rank) {
  return RANK_VALUE[rank] * 12;
}

/**
 * その幻想体から抽出できるEGOの最大個数（高ランクほど多い）
 */
export function egoMaxCount(rank) {
  return RANK_VALUE[rank]; // ZAYIN:1 〜 ALEPH:5
}

/**
 * 幻想体からEGO武器の実体アイテムを生成する（在庫に追加する用）
 */
export function makeEgoWeaponItem(ab) {
  return {
    id: `ego_w_${itemIdCounter++}`,
    type: "weapon",
    sourceId: ab.id,
    name: `${ab.name}・武装`,
    rank: ab.rank,
    damageType: ab.damageType,
    power: WEAPON_POWER_BY_RANK[ab.rank] ?? 10,
  };
}

/**
 * 幻想体からEGO防具の実体アイテムを生成する（在庫に追加する用）
 */
export function makeEgoArmorItem(ab) {
  return {
    id: `ego_a_${itemIdCounter++}`,
    type: "armor",
    sourceId: ab.id,
    name: `${ab.name}・防具`,
    rank: ab.rank,
    resistance: { ...ab.resistance },
  };
}

export function canExtractMore(ab) {
  const count = ab.egoExtractedCount || 0;
  return ab.unlockedInfo?.manual && count < egoMaxCount(ab.rank);
}
