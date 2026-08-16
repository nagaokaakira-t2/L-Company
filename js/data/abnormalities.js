// ============================================================
// abnormalities.js
// 幻想体（アブノーマリティ）のマスターデータ（全30体）
// 新規追加時はこの配列にオブジェクトを足すだけで管理画面・選定画面に反映される
// ============================================================

// 4つの作業タイプ
export const WORK_TYPES = ["INSTINCT", "INSIGHT", "ATTACHMENT", "REPRESSION"];
export const WORK_LABEL = {
  INSTINCT: "本能",
  INSIGHT: "洞察",
  ATTACHMENT: "愛着",
  REPRESSION: "抑圧",
};

// 脱走型 or 能力発動型
export const BREACH_TYPE = {
  ESCAPE: "escape", // 収容室から出て職員を襲う
  ABILITY: "ability", // 収容室内から特殊能力を発動
};

// ランクごとの既定クリフォト猶予（放置できるターン数）
const QLIPHOTH_BY_RANK = { ZAYIN: 8, TETH: 6, HE: 5, WAW: 4, ALEPH: 3 };

// ============================================================
// 分類番号（X-XX-XX）
// X      : 根源 … O=Original / F=Fairy Tale / T=Trauma / D=Donator
// XX(中) : タイプ … 01人型 02動物 03宗教・抽象・無機物 04植物・昆虫 05機械・器物 06不定形 09ツール型
// XX(末) : そのカテゴリー内の固有シリアル番号
// 名前が未解禁の間は、この番号と3行の観測前紹介文のみが表示される。
// ============================================================
const CLASS_CODE = {
  silent_girl:          ["T", "01", 1],
  paper_crane_flock:    ["F", "04", 1],
  dripping_faucet:      ["O", "09", 1],
  tea_stained_ghost:    ["T", "09", 1],
  broken_umbrella:      ["O", "09", 2],
  humming_kettle:       ["F", "09", 1],
  clock_eater:          ["O", "05", 1],
  crimson_scissors:     ["T", "09", 2],
  veiled_bride:         ["F", "01", 1],
  static_choir:         ["O", "03", 1],
  iron_lung_child:      ["T", "05", 1],
  hollow_choirmaster:   ["F", "01", 2],
  red_shepherd:         ["F", "01", 3],
  gilded_locust:        ["O", "04", 1],
  drowned_orchestra:    ["F", "01", 4],
  thorned_confessional: ["T", "09", 3],
  porcelain_twins:      ["F", "01", 5],
  black_tide_letter:    ["T", "09", 4],
  white_womb:           ["O", "06", 1],
  gallows_choir:        ["T", "05", 2],
  weeping_cartographer: ["F", "01", 6],
  iron_maiden_bloom:    ["T", "05", 3],
  still_life_famine:    ["O", "03", 2],
  hundred_eyed_curator: ["O", "01", 1],
  black_maestro:        ["F", "01", 7],
  cathedral_of_teeth:   ["T", "03", 1],
  the_uncounted_hour:   ["O", "03", 3],
  last_lullaby_engine:  ["T", "05", 4],
  drowning_cityscape:   ["O", "05", 2],
  the_final_appetite:   ["T", "02", 1],
  // ── 能力発動型 追加分 ──
  z_washbasin:          ["O", "09", 3],
  z_wallpaper:          ["F", "03", 1],
  z_broom:              ["O", "09", 4],
  z_mailbox:            ["T", "09", 5],
  t_bottle:             ["O", "09", 5],
  t_specimen_shelf:     ["D", "05", 1],
  t_fireplace:          ["T", "05", 5],
  t_mirror:             ["F", "09", 2],
  h_bookshelf:          ["O", "09", 6],
  h_bathtub:            ["T", "09", 6],
  h_compass_needle:     ["O", "05", 3],
  h_lighthouse:         ["D", "05", 2],
  w_attic:              ["T", "03", 2],
  w_greenhouse:         ["F", "04", 2],
  w_staircase:          ["O", "03", 4],
  w_theater:            ["D", "01", 1],
};

// ============================================================
// PE Box（作業結果評価）設定
// 作業結果は GOOD / NORMAL / BAD の3段階で判定され、
// クリフォトカウンターの増減量はランクごとの既定値（もしくは
// 個別の peBoxOverride）に従う。ランクが高いほどGOODを引きにくく、
// BADに転びやすく、増減幅も大きくなる（ハイリスク・ハイリターン）。
// 個別の幻想体で挙動を変えたい場合は、そのオブジェクトに
// `peBoxOverride: { goodThreshold, badThreshold, goodQliphothBonus, badQliphothPenalty }`
// を追加すれば既定値を上書きできる。
// ============================================================
export function getPeBoxConfig(ab) {
  if (ab.peBoxOverride) return ab.peBoxOverride;
  const r = RANK_VALUE_LOCAL[ab.rank];
  return {
    goodThreshold: 0.72 + r * 0.02,
    badThreshold: 0.30 + r * 0.02,
    goodQliphothBonus: 1 + Math.ceil(r / 2),
    badQliphothPenalty: 1 + Math.ceil(r / 2),
  };
}
const RANK_VALUE_LOCAL = { ZAYIN: 1, TETH: 2, HE: 3, WAW: 4, ALEPH: 5 };

export function classificationCode(id) {
  const c = CLASS_CODE[id];
  if (!c) return "?-00-00";
  const [origin, type, serial] = c;
  return `${origin}-${type}-${String(serial).padStart(2, "0")}`;
}

// 観測（名前解禁）前に表示する3行の紹介文を組み立てる
const BREACH_INTRO_LINE = {
  [BREACH_TYPE.ESCAPE]: "収容区画外への逸脱傾向を確認。接触時は要注意。",
  [BREACH_TYPE.ABILITY]: "収容区画内からの干渉現象を確認。観測を継続する。",
};
const CLOSING_INTRO_POOL = [
  "総務局による危険度評価は未完了。",
  "本記録に関する追加情報は観測進行に伴い開示される。",
  "現時点で得られている情報は限定的である。",
  "職員の接触記録が乏しく、詳細は不明のままである。",
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function getIntroLines(ab) {
  const line2 = BREACH_INTRO_LINE[ab.breachType] ?? "特異な挙動が報告されている。";
  const line3 = CLOSING_INTRO_POOL[hashString(ab.id) % CLOSING_INTRO_POOL.length];
  return [ab.flavor, line2, line3];
}

export const ABNORMALITY_POOL = [
  // ───────── ZAYIN（安全）─────────
  {
    id: "silent_girl", name: "静かな少女", codename: "不穏な着物の噂", rank: "ZAYIN",
    preferredWork: "ATTACHMENT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 8,
    resistance: { RED: 1.0, WHITE: 1.2, BLACK: 1.0, PALE: 1.0 },
    flavor: "誰も見ていないと着物の裾が独りでに揺れる。",
  },
  {
    id: "paper_crane_flock", name: "紙鶴の群れ", codename: "折られ続ける手紙の噂", rank: "ZAYIN",
    preferredWork: "INSIGHT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 6,
    resistance: { RED: 1.1, WHITE: 0.7, BLACK: 1.0, PALE: 1.0 },
    flavor: "折られるたびに一羽増える。誰が折っているのかは分からない。",
  },
  {
    id: "dripping_faucet", name: "滴る蛇口", codename: "止まらない水音の噂", rank: "ZAYIN",
    preferredWork: "INSTINCT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 7,
    resistance: { RED: 0.8, WHITE: 1.0, BLACK: 1.0, PALE: 1.2 },
    flavor: "締めても締めても、廊下の奥で水滴の音が続く。",
  },
  {
    id: "tea_stained_ghost", name: "茶渋の亡霊", codename: "誰も座らない椅子の噂", rank: "ZAYIN",
    preferredWork: "REPRESSION", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "BLACK", baseAttack: 7,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 0.6, PALE: 1.0 },
    flavor: "湯呑みの染みが、毎朝同じ形に浮かび上がる。",
  },
  {
    id: "broken_umbrella", name: "壊れた雨傘", codename: "晴れの日の忘れ物の噂", rank: "ZAYIN",
    preferredWork: "ATTACHMENT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 6,
    resistance: { RED: 1.0, WHITE: 0.9, BLACK: 1.1, PALE: 1.0 },
    flavor: "骨が一本、また一本と、勝手に開いていく。",
  },
  {
    id: "humming_kettle", name: "歌うやかん", codename: "沸かなくなった湯の噂", rank: "ZAYIN",
    preferredWork: "INSIGHT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 8,
    resistance: { RED: 1.2, WHITE: 0.6, BLACK: 1.0, PALE: 1.0 },
    flavor: "火にかけていないのに、給湯室からいつも歌うような音がする。",
  },

  // ───────── TETH ─────────
  {
    id: "clock_eater", name: "時計喰らい", codename: "止まらない時計店の噂", rank: "TETH",
    preferredWork: "INSIGHT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 14,
    resistance: { RED: 0.6, WHITE: 1.3, BLACK: 1.0, PALE: 1.0 },
    flavor: "施設内の時計という時計が、少しずつ狂い始めている。",
  },
  {
    id: "crimson_scissors", name: "緋色の鋏", codename: "裁縫室から響く音の噂", rank: "TETH",
    preferredWork: "INSTINCT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 16,
    resistance: { RED: 0.5, WHITE: 1.0, BLACK: 1.0, PALE: 1.1 },
    flavor: "布を裁つ音が止まらない。もう布は残っていないはずなのに。",
  },
  {
    id: "veiled_bride", name: "面紗の花嫁", codename: "式を待ち続ける影の噂", rank: "TETH",
    preferredWork: "ATTACHMENT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ESCAPE,
    damageType: "BLACK", baseAttack: 13,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 0.7, PALE: 1.2 },
    flavor: "誰も来ない祭壇の前で、今日も静かに佇んでいる。",
  },
  {
    id: "static_choir", name: "砂嵐の聖歌隊", codename: "電波に混じる歌声の噂", rank: "TETH",
    preferredWork: "INSIGHT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 15,
    resistance: { RED: 1.1, WHITE: 0.5, BLACK: 1.0, PALE: 1.0 },
    flavor: "モニターのノイズの向こうから、合唱が聞こえてくる。",
  },
  {
    id: "iron_lung_child", name: "鉄の肺の子", codename: "呼吸の止まらない機械の噂", rank: "TETH",
    preferredWork: "REPRESSION", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ABILITY,
    damageType: "BLACK", baseAttack: 14,
    resistance: { RED: 0.9, WHITE: 0.9, BLACK: 0.6, PALE: 1.0 },
    flavor: "機械仕掛けの呼吸音が、夜になると規則を崩す。",
  },
  {
    id: "hollow_choirmaster", name: "空ろな聖歌隊長", codename: "指揮棒だけの噂", rank: "TETH",
    preferredWork: "INSIGHT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ESCAPE,
    damageType: "PALE", baseAttack: 12,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 1.0, PALE: 0.7 },
    flavor: "指揮棒だけが宙に浮き、誰もいない聖歌隊を導き続ける。",
  },

  // ───────── HE ─────────
  {
    id: "red_shepherd", name: "紅の牧羊者", codename: "羊を数える声の噂", rank: "HE",
    preferredWork: "REPRESSION", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "BLACK", baseAttack: 22,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 0.5, PALE: 1.2 },
    flavor: "夜になると羊を数える声が管を伝って響いてくる。",
  },
  {
    id: "gilded_locust", name: "金箔の蝗", codename: "食い尽くされた蔵の噂", rank: "HE",
    preferredWork: "INSTINCT", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 24,
    resistance: { RED: 0.7, WHITE: 1.0, BLACK: 1.0, PALE: 1.0 },
    flavor: "金色の羽音がすると、翌朝には何かが必ず食い尽くされている。",
  },
  {
    id: "drowned_orchestra", name: "溺れた管弦楽団", codename: "沈んだ演奏会場の噂", rank: "HE",
    preferredWork: "ATTACHMENT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 21,
    resistance: { RED: 1.0, WHITE: 0.6, BLACK: 1.0, PALE: 1.1 },
    flavor: "水に沈んだはずの楽団が、今も演奏を続けている。",
  },
  {
    id: "thorned_confessional", name: "棘の告解室", codename: "懺悔が漏れる小部屋の噂", rank: "HE",
    preferredWork: "REPRESSION", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "BLACK", baseAttack: 23,
    resistance: { RED: 0.8, WHITE: 0.8, BLACK: 0.5, PALE: 1.0 },
    flavor: "扉の隙間から、誰のものでもない懺悔の声が漏れ続ける。",
  },
  {
    id: "porcelain_twins", name: "陶器の双子", codename: "割れない人形の噂", rank: "HE",
    preferredWork: "ATTACHMENT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 20,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 1.0, PALE: 0.6 },
    flavor: "どれだけ叩き割っても、翌朝には二体揃って棚に戻っている。",
  },
  {
    id: "black_tide_letter", name: "黒潮の手紙", codename: "届かない郵便の噂", rank: "HE",
    preferredWork: "INSIGHT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "WHITE", baseAttack: 25,
    resistance: { RED: 1.1, WHITE: 0.4, BLACK: 1.0, PALE: 1.0 },
    flavor: "黒い染みが広がる封筒には、まだ誰も読めない文字が並ぶ。",
  },

  // ───────── WAW ─────────
  {
    id: "white_womb", name: "白い胎座", codename: "産まれ続ける部屋の噂", rank: "WAW",
    preferredWork: "INSTINCT", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 30,
    resistance: { RED: 0.8, WHITE: 0.8, BLACK: 0.8, PALE: 0.3 },
    flavor: "壁の奥から、何かが生まれ続ける鼓動が聞こえる。",
  },
  {
    id: "gallows_choir", name: "絞首台の合唱", codename: "処刑台の歌声の噂", rank: "WAW",
    preferredWork: "REPRESSION", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "BLACK", baseAttack: 32,
    resistance: { RED: 0.6, WHITE: 0.6, BLACK: 0.4, PALE: 1.0 },
    flavor: "縄が軋む音に合わせて、大勢の声が同じ歌を歌っている。",
  },
  {
    id: "weeping_cartographer", name: "泣く地図製作者", codename: "描き変わる地図の噂", rank: "WAW",
    preferredWork: "INSIGHT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 29,
    resistance: { RED: 1.0, WHITE: 0.5, BLACK: 0.9, PALE: 1.0 },
    flavor: "描いた地図の道が、涙を流すたびに書き変わっていく。",
  },
  {
    id: "iron_maiden_bloom", name: "鉄処女の花", codename: "花咲く拷問器具の噂", rank: "WAW",
    preferredWork: "INSTINCT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 34,
    resistance: { RED: 0.5, WHITE: 1.0, BLACK: 1.0, PALE: 0.9 },
    flavor: "内側の棘が、なぜか季節ごとに花を咲かせる。",
  },
  {
    id: "still_life_famine", name: "静物の飢餓", codename: "腐らない果物画の噂", rank: "WAW",
    preferredWork: "ATTACHMENT", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 28,
    resistance: { RED: 0.9, WHITE: 0.9, BLACK: 0.9, PALE: 0.4 },
    flavor: "描かれた果物は腐らない代わりに、見る者の食欲を奪っていく。",
  },
  {
    id: "hundred_eyed_curator", name: "百目の学芸員", codename: "監視され続ける展示室の噂", rank: "WAW",
    preferredWork: "INSIGHT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "WHITE", baseAttack: 33,
    resistance: { RED: 1.0, WHITE: 0.5, BLACK: 1.0, PALE: 1.1 },
    flavor: "展示物の一つ一つに、こちらを見返す目がある。",
  },

  // ───────── ALEPH ─────────
  {
    id: "black_maestro", name: "黒の指揮者", codename: "終わらない演奏会の噂", rank: "ALEPH",
    preferredWork: "INSIGHT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ESCAPE,
    damageType: "PALE", baseAttack: 45,
    resistance: { RED: 0.5, WHITE: 0.5, BLACK: 0.5, PALE: 0.6 },
    flavor: "指揮棒が振られるたび、施設のどこかで悲鳴が止む。",
  },
  {
    id: "cathedral_of_teeth", name: "歯の大聖堂", codename: "噛み砕かれた祈りの噂", rank: "ALEPH",
    preferredWork: "INSTINCT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "BLACK", baseAttack: 50,
    resistance: { RED: 0.4, WHITE: 0.4, BLACK: 0.4, PALE: 1.0 },
    flavor: "尖塔の代わりに、無数の歯が空へ向かって並んでいる。",
  },
  {
    id: "the_uncounted_hour", name: "数えられぬ刻", codename: "存在しない時報の噂", rank: "ALEPH",
    preferredWork: "REPRESSION", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 42,
    resistance: { RED: 0.6, WHITE: 0.6, BLACK: 0.6, PALE: 0.3 },
    flavor: "施設の時計が、存在しないはずの13時を指す瞬間がある。",
  },
  {
    id: "last_lullaby_engine", name: "最後の子守唄機関", codename: "止まらない子守唄の噂", rank: "ALEPH",
    preferredWork: "ATTACHMENT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 44,
    resistance: { RED: 0.5, WHITE: 0.4, BLACK: 0.7, PALE: 1.0 },
    flavor: "誰かを眠らせるための歌が、聞く者の意識ごと閉じ込めていく。",
  },
  {
    id: "drowning_cityscape", name: "溺れる都市模型", codename: "沈み続けるジオラマの噂", rank: "ALEPH",
    preferredWork: "INSIGHT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ESCAPE,
    damageType: "RED", baseAttack: 48,
    resistance: { RED: 0.4, WHITE: 0.7, BLACK: 0.7, PALE: 1.0 },
    flavor: "精巧な都市の模型が、見ている間にゆっくりと水没していく。",
  },
  {
    id: "the_final_appetite", name: "最後の食欲", codename: "満たされない食卓の噂", rank: "ALEPH",
    preferredWork: "INSTINCT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ESCAPE,
    damageType: "BLACK", baseAttack: 55,
    resistance: { RED: 0.5, WHITE: 0.5, BLACK: 0.3, PALE: 0.9 },
    flavor: "どれだけ捧げても、その食卓の皿は決して満たされない。",
  },

  // ───────── 能力発動型 追加分（ALEPHには追加しない）─────────
  // ZAYIN
  {
    id: "z_washbasin", name: "凍える洗面器", codename: "波打つ洗面台の噂", rank: "ZAYIN",
    preferredWork: "INSIGHT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 7,
    resistance: { RED: 1.1, WHITE: 0.7, BLACK: 1.0, PALE: 1.0 },
    flavor: "蛇口を捻っていないのに、水面が独りでに波打つ。",
  },
  {
    id: "z_wallpaper", name: "囁く壁紙", codename: "模様が動く部屋の噂", rank: "ZAYIN",
    preferredWork: "ATTACHMENT", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "BLACK", baseAttack: 6,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 0.7, PALE: 1.1 },
    flavor: "壁紙の柄が、瞬きの間に配置を変えている。",
  },
  {
    id: "z_broom", name: "居眠りの箒", codename: "独りでに掃く箒の噂", rank: "ZAYIN",
    preferredWork: "REPRESSION", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ABILITY,
    damageType: "RED", baseAttack: 6,
    resistance: { RED: 0.8, WHITE: 1.0, BLACK: 1.0, PALE: 1.0 },
    flavor: "誰も使っていないのに、箒の穂先だけが微かに動く。",
  },
  {
    id: "z_mailbox", name: "錆びた郵便受け", codename: "届くはずのない手紙の噂", rank: "ZAYIN",
    preferredWork: "INSTINCT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "BLACK", baseAttack: 7,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 0.6, PALE: 1.0 },
    flavor: "届くはずのない差出人からの手紙が、時折投函されている。",
  },
  // TETH
  {
    id: "t_bottle", name: "反響する空き瓶", codename: "割れない瓶の音の噂", rank: "TETH",
    preferredWork: "INSIGHT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 14,
    resistance: { RED: 1.0, WHITE: 0.5, BLACK: 1.0, PALE: 1.0 },
    flavor: "割れているはずの瓶の奥から、規則的な反響音がする。",
  },
  {
    id: "t_specimen_shelf", name: "揺れる標本棚", codename: "見返す標本の噂", rank: "TETH",
    preferredWork: "REPRESSION", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 12,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 1.0, PALE: 0.6 },
    flavor: "棚のガラス越しに、標本と目が合う気がしてならない。",
  },
  {
    id: "t_fireplace", name: "凍りつく暖炉", codename: "火の気のない暖炉の噂", rank: "TETH",
    preferredWork: "INSTINCT", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "RED", baseAttack: 15,
    resistance: { RED: 0.5, WHITE: 1.0, BLACK: 1.0, PALE: 1.1 },
    flavor: "火の気がないのに、暖炉の中だけが凍りついている。",
  },
  {
    id: "t_mirror", name: "泣き虫の姿見", codename: "一拍遅れる鏡の噂", rank: "TETH",
    preferredWork: "ATTACHMENT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 13,
    resistance: { RED: 1.1, WHITE: 0.5, BLACK: 1.0, PALE: 1.0 },
    flavor: "鏡に映る自分が、一拍遅れてこちらを見る。",
  },
  // HE
  {
    id: "h_bookshelf", name: "軋む書架", codename: "抗議する書架の噂", rank: "HE",
    preferredWork: "INSIGHT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ABILITY,
    damageType: "BLACK", baseAttack: 22,
    resistance: { RED: 0.9, WHITE: 0.9, BLACK: 0.5, PALE: 1.0 },
    flavor: "本を一冊抜くたびに、書架全体が軋んで抗議する。",
  },
  {
    id: "h_bathtub", name: "満ちる浴槽", codename: "止まらない水位の噂", rank: "HE",
    preferredWork: "INSTINCT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 20,
    resistance: { RED: 1.0, WHITE: 1.0, BLACK: 1.0, PALE: 0.5 },
    flavor: "止めても止めても、浴槽の水位が静かに上がり続ける。",
  },
  {
    id: "h_compass_needle", name: "回り続ける針", codename: "時刻を指さない針の噂", rank: "HE",
    preferredWork: "REPRESSION", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 23,
    resistance: { RED: 1.0, WHITE: 0.5, BLACK: 0.9, PALE: 1.0 },
    flavor: "針は時刻ではなく、別の何かを指し続けている。",
  },
  {
    id: "h_lighthouse", name: "眠らない標識灯", codename: "誰もいない海への灯りの噂", rank: "HE",
    preferredWork: "ATTACHMENT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "RED", baseAttack: 24,
    resistance: { RED: 0.6, WHITE: 1.0, BLACK: 1.0, PALE: 1.0 },
    flavor: "誰も航行していない海に向けて、灯りだけが点滅を続ける。",
  },
  // WAW
  {
    id: "w_attic", name: "軋む天井裏", codename: "延々と響く足音の噂", rank: "WAW",
    preferredWork: "INSIGHT", dislikedWork: "REPRESSION", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 29,
    resistance: { RED: 0.8, WHITE: 0.8, BLACK: 0.8, PALE: 0.4 },
    flavor: "天井裏から、規則正しい足音が延々と響いてくる。",
  },
  {
    id: "w_greenhouse", name: "満月の温室", codename: "人の輪郭を象る植物の噂", rank: "WAW",
    preferredWork: "ATTACHMENT", dislikedWork: "INSTINCT", breachType: BREACH_TYPE.ABILITY,
    damageType: "WHITE", baseAttack: 31,
    resistance: { RED: 1.0, WHITE: 0.5, BLACK: 0.9, PALE: 1.0 },
    flavor: "満月の夜だけ、温室の植物が人の輪郭を象る。",
  },
  {
    id: "w_staircase", name: "凍える大階段", codename: "上るほど凍てつく階段の噂", rank: "WAW",
    preferredWork: "INSTINCT", dislikedWork: "ATTACHMENT", breachType: BREACH_TYPE.ABILITY,
    damageType: "BLACK", baseAttack: 33,
    resistance: { RED: 0.6, WHITE: 0.9, BLACK: 0.5, PALE: 1.0 },
    flavor: "上るほどに、大階段の先が凍てついていく。",
  },
  {
    id: "w_theater", name: "軋轢の劇場", codename: "客席から上がる悲鳴の噂", rank: "WAW",
    preferredWork: "REPRESSION", dislikedWork: "INSIGHT", breachType: BREACH_TYPE.ABILITY,
    damageType: "PALE", baseAttack: 30,
    resistance: { RED: 0.9, WHITE: 0.9, BLACK: 0.9, PALE: 0.4 },
    flavor: "幕が上がるたび、客席のどこかで悲鳴が上がる。",
  },
];

export function getAbnormalityTemplate(id) {
  const found = ABNORMALITY_POOL.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown abnormality id: ${id}`);
  return found;
}

/**
 * 収容中インスタンスを生成する（テンプレートからゲーム内状態を持つオブジェクトへ）
 */
export function instantiateAbnormality(id) {
  const t = getAbnormalityTemplate(id);
  const qliphothMax = QLIPHOTH_BY_RANK[t.rank];
  return {
    ...t,
    classCode: classificationCode(id),
    maxMood: 100,
    qliphothMax,
    mood: 70, // 機嫌値 0-100
    qliphoth: qliphothMax, // 残りカウントダウン
    unlockedInfo: { name: false, manual: false },
    infoPoints: 0,
    contained: true,
    breached: false,
  };
}
