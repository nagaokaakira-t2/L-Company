// ============================================================
// roomArt.js
// 収容室の扉イラストをランク・タイプ分類・状態から組み立てる
// （幻想体46体それぞれに手描きファイルを用意する代わりに、
//   ランク色・タイプ別モチーフ・状態カラーを組み合わせて
//   フラット/ミニマルな「扉」イラストを生成する）
// ============================================================

import { typeCodeOf } from "../data/abnormalities.js";

export const RANK_COLOR = {
  ZAYIN: "#6fae6f",
  TETH: "#6f9fae",
  HE: "#c9a344",
  WAW: "#c46a3a",
  ALEPH: "#b23a4a",
};

// タイプ分類ごとのモチーフ（0 0 64 64 ビューポート基準のシルエットpath）
const TYPE_MOTIF = {
  "01": '<circle cx="32" cy="22" r="10"/><path d="M14 50c0-11 8-18 18-18s18 7 18 18Z"/>', // 人型
  "02": '<path d="M20 40 Q13 27 22 21 Q28 15 32 21 Q36 15 42 21 Q51 27 44 40 Q38 47 32 45 Q26 47 20 40Z"/>', // 動物・生物型
  "03": '<path d="M32 11 L45 26 L39 45 L25 45 L19 26 Z"/>', // 宗教・抽象・無機物
  "04": '<path d="M32 47 C19 40 15 27 24 17 C28 24 30 30 32 30 C34 30 36 24 40 17 C49 27 45 40 32 47Z"/>', // 植物・昆虫型
  "05": '<rect x="18" y="20" width="28" height="24" rx="2"/><rect x="12" y="27" width="6" height="10"/><rect x="46" y="27" width="6" height="10"/>', // 機械・アーティファクト型
  "06": '<path d="M32 15c11 0 18 9 15 20-3 10-11 15-15 15s-12-5-15-15c-3-11 4-20 15-20Z"/>', // 不定形・粘体型
  "09": '<path d="M27 13h10v13l9 5v9l-9 5v6h-10v-6l-9-5v-9l9-5Z"/>', // ツール型
};

function motifFor(id) {
  return TYPE_MOTIF[typeCodeOf(id)] ?? TYPE_MOTIF["09"];
}

/**
 * 幻想体1体分の収容室ドアSVG（マークアップ文字列）を生成する
 * @param {object} ab 幻想体インスタンス
 * @param {object} opts { size }
 */
export function buildDoorSVG(ab, opts = {}) {
  const size = opts.size ?? 120;
  const observed = ab.unlockedInfo.name;
  const rankColor = RANK_COLOR[ab.rank] ?? "#888";
  const motif = motifFor(ab.id);
  const statusColor = ab.breached ? "#d1444f" : ab.mood < 40 ? "#c9a344" : "#6fae6f";
  const doorFill = observed ? "#232733" : "#1b1d24";
  const dash = observed ? "" : 'stroke-dasharray="5 4"';
  const glow = ab.breached ? `<circle cx="32" cy="32" r="30" fill="${statusColor}" opacity="0.12"/>` : "";

  return `
<svg viewBox="0 0 64 78" width="${size}" height="${Math.round(size * 1.22)}" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="16" width="58" height="58" rx="5" fill="${doorFill}" stroke="${rankColor}" stroke-width="3" ${dash}/>
  ${glow}
  <circle cx="32" cy="42" r="15" fill="#10121a" stroke="${rankColor}" stroke-width="2"/>
  <g transform="translate(32,42) scale(0.42) translate(-32,-32)" fill="${rankColor}" opacity="0.9">${motif}</g>
  <circle cx="13" cy="24" r="3.4" fill="${statusColor}"/>
  <rect x="20" y="64" width="24" height="6" rx="2" fill="${rankColor}" opacity="0.55"/>
  <rect x="0" y="0" width="64" height="14" rx="3" fill="#14161d" stroke="${rankColor}" stroke-width="1.5"/>
</svg>`;
}

// 職員アバターのバリエーション用パレット（IDのハッシュで割り当てる）
export const STAFF_PALETTE = [
  { skin: "#c9a98a", hair: "#4a3626" },
  { skin: "#a97e5c", hair: "#1c1c1c" },
  { skin: "#e0b99a", hair: "#7a4a2a" },
  { skin: "#8b6244", hair: "#2a1e14" },
  { skin: "#d9b48f", hair: "#5c3a1e" },
  { skin: "#c48a68", hair: "#302010" },
];

function hashStaffId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function buildStaffAvatarSVG(staff, opts = {}) {
  const size = opts.size ?? 40;
  const palette = STAFF_PALETTE[hashStaffId(staff.id) % STAFF_PALETTE.length];
  const outline = !staff.alive ? "#555" : !staff.sane ? "#8a5a9a" : staff.panic ? "#c9a344" : "#444a5a";
  return `
<svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="27" fill="#22242e" stroke="${outline}" stroke-width="2.5"/>
  <circle cx="32" cy="25" r="9.5" fill="${palette.skin}"/>
  <path d="M20 22 Q22 10 32 10 Q42 10 44 22 Q36 17 32 17 Q28 17 20 22Z" fill="${palette.hair}"/>
  <path d="M15 52 C15 38 22 33 32 33 C42 33 49 38 49 52" fill="${palette.skin}" opacity="0.9"/>
</svg>`;
}
