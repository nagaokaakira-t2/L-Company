// ============================================================
// render.js
// DOM描画専用モジュール（フレームワーク不使用の素朴なレンダラー）
// ============================================================

import { WORK_TYPES, WORK_LABEL, classificationCode, getIntroLines } from "../data/abnormalities.js";
import { STAT_LABEL, statTotal } from "../data/staff.js";
import { RANK_VALUE } from "../systems/damage.js";
import { unlockCost, egoExtractCost, egoMaxCount } from "../data/ego.js";

const RANK_COLOR = {
  ZAYIN: "#6fae6f",
  TETH: "#6f9fae",
  HE: "#c9a344",
  WAW: "#c46a3a",
  ALEPH: "#b23a4a",
};

const RANK_ICON = {
  ZAYIN: "assets/rank_zayin.svg",
  TETH: "assets/rank_teth.svg",
  HE: "assets/rank_he.svg",
  WAW: "assets/rank_waw.svg",
  ALEPH: "assets/rank_aleph.svg",
};

const WORK_ICON = {
  INSTINCT: "assets/work_instinct.svg",
  INSIGHT: "assets/work_insight.svg",
  ATTACHMENT: "assets/work_attachment.svg",
  REPRESSION: "assets/work_repression.svg",
};

const DAMAGE_ICON = {
  RED: "assets/damage_red.svg",
  WHITE: "assets/damage_white.svg",
  BLACK: "assets/damage_black.svg",
  PALE: "assets/damage_pale.svg",
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function img(src, cls, alt) {
  const i = document.createElement("img");
  i.src = src;
  if (cls) i.className = cls;
  i.alt = alt || "";
  return i;
}

function rankBadge(rank) {
  const b = el("span", "rank-badge", rank);
  b.style.background = RANK_COLOR[rank] || "#888";
  return b;
}

function rankIcon(rank, cls) {
  return img(RANK_ICON[rank], cls || "icon-md", rank);
}

// 名前が未解禁の間は、ランクアイコンの代わりに「？」アイコンを表示する
function rankIconOrUnknown(ab, cls) {
  if (!ab.unlockedInfo.name) return img("assets/rank_unknown.svg", cls || "icon-md", "未観測");
  return rankIcon(ab.rank, cls);
}

function bar(value, max, cls) {
  const wrap = el("div", `bar-wrap ${cls || ""}`);
  const fill = el("div", "bar-fill");
  fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  wrap.appendChild(fill);
  return wrap;
}

export function renderHeader(state) {
  document.getElementById("day-label").textContent = `${state.day} / 50 日目`;
  document.getElementById("energy-label").textContent =
    `エネルギー: ${state.energy.toFixed(0)} / ${state.quota}`;
  const btn = document.getElementById("end-day-btn");
  btn.disabled = state.energy < state.quota;
}

export function renderLog(state) {
  const box = document.getElementById("log-box");
  box.innerHTML = "";
  for (const line of state.log.slice(0, 40)) {
    box.appendChild(el("div", "log-line", line));
  }
}

const TIER_CAPACITY = 10; // 1段あたりの収容数（5体 × 2列）
const TIER_LABELS = ["収容区画 上段", "収容区画 下段", "収容区画 下段2", "収容区画 下段3", "収容区画 下段4"];

export function renderAbnormalities(state, { onWork, onOpenDetail, selection, onSelectionChange }) {
  const container = document.getElementById("abnormality-list");
  container.innerHTML = "";

  // 5体ごとに縦列を折り返し、10体（2列）ごとに新しい「段」を作る
  for (let tierStart = 0; tierStart < state.abnormalities.length; tierStart += TIER_CAPACITY) {
    const tierAbs = state.abnormalities.slice(tierStart, tierStart + TIER_CAPACITY);
    const tierIndex = tierStart / TIER_CAPACITY;

    const tierWrap = el("div", "ab-tier");
    tierWrap.appendChild(el("h3", "tier-label", TIER_LABELS[tierIndex] || `収容区画 下段${tierIndex}`));
    const grid = el("div", "ab-tier-grid");

    for (const ab of tierAbs) {
      const observed = ab.unlockedInfo.name;
      const card = el("div", "card ab-card" + (ab.breached ? " breached" : "") + (!observed ? " unobserved" : ""));
      const head = el("div", "card-head");
      head.appendChild(rankIconOrUnknown(ab, "icon-lg"));
      const nameWrap = el("div", "name-wrap");
      if (observed) {
        nameWrap.appendChild(rankBadge(ab.rank));
        nameWrap.appendChild(el("span", "ab-name", ab.name));
      } else {
        nameWrap.appendChild(el("span", "class-code", ab.classCode));
      }
      head.appendChild(nameWrap);
      if (observed) head.appendChild(img(DAMAGE_ICON[ab.damageType], "icon-sm damage-icon", ab.damageType));
      card.appendChild(head);

      if (observed) {
        card.appendChild(el("div", "flavor", ab.flavor));
      } else {
        const introBox = el("div", "intro-lines");
        for (const line of getIntroLines(ab)) {
          introBox.appendChild(el("div", "intro-line", line));
        }
        card.appendChild(introBox);
      }

      if (ab.breached) {
        card.appendChild(el("div", "warn", `⚠ 暴走中（${ab.breachType === "escape" ? "脱走" : "能力発動"}）`));
      } else {
        const moodRow = el("div", "stat-row");
        moodRow.appendChild(el("span", "stat-label", "機嫌"));
        moodRow.appendChild(bar(ab.mood, ab.maxMood, "mood"));
        moodRow.appendChild(el("span", "stat-num", `${ab.mood}/${ab.maxMood}`));
        card.appendChild(moodRow);

        const qRow = el("div", "stat-row");
        qRow.appendChild(el("span", "stat-label", "クリフォト"));
        qRow.appendChild(bar(ab.qliphoth, ab.qliphothMax, "qliphoth"));
        qRow.appendChild(el("span", "stat-num", `${ab.qliphoth}/${ab.qliphothMax}`));
        card.appendChild(qRow);

        const sel = selection[ab.id] || {};

        const staffSelect = el("select", "staff-select");
        staffSelect.dataset.abId = ab.id;
        for (const s of state.staffList) {
          if (!s.alive || !s.sane) continue;
          const opt = el("option", null, `${s.name} (Lv${s.level})`);
          opt.value = s.id;
          staffSelect.appendChild(opt);
        }
        if (sel.staff && staffSelect.querySelector(`option[value="${sel.staff}"]`)) {
          staffSelect.value = sel.staff;
        }
        staffSelect.onchange = () => onSelectionChange(ab.id, "staff", staffSelect.value);

        const workSelect = el("select", "work-select");
        for (const w of WORK_TYPES) {
          const opt = el("option", null, WORK_LABEL[w]);
          opt.value = w;
          if (w === ab.preferredWork) opt.textContent += " ◎好み";
          if (w === ab.dislikedWork) opt.textContent += " ×嫌い";
          workSelect.appendChild(opt);
        }
        if (sel.work) workSelect.value = sel.work;
        workSelect.onchange = () => onSelectionChange(ab.id, "work", workSelect.value);

        const workBtn = el("button", "btn small", "作業実行");
        workBtn.onclick = () => {
          if (!staffSelect.value) return;
          onWork(staffSelect.value, ab.id, workSelect.value);
        };

        const controls = el("div", "controls");
        controls.appendChild(staffSelect);
        controls.appendChild(workSelect);
        controls.appendChild(workBtn);
        card.appendChild(controls);

        const detailBtn = el("button", "btn small ghost", "詳細を見る（情報開示／EGO抽出）");
        detailBtn.onclick = () => onOpenDetail(ab.id);
        card.appendChild(detailBtn);

        const infoRow = el("div", "info-row", `情報ポイント: ${ab.infoPoints}`);
        card.appendChild(infoRow);
      }

      grid.appendChild(card);
    }

    tierWrap.appendChild(grid);
    container.appendChild(tierWrap);
  }
}

export function renderStaff(state, { onEquipWeapon, onEquipArmor, expandedIds, onToggleExpand }) {
  const container = document.getElementById("staff-list");
  container.innerHTML = "";
  const inventory = state.egoInventory || [];

  for (const s of state.staffList) {
    const expanded = expandedIds.has(s.id);
    const card = el(
      "div",
      "card staff-card" +
        (!s.alive ? " dead" : !s.sane ? " insane" : "") +
        (s.panic ? " panicking" : "") +
        (expanded ? " expanded" : " collapsed")
    );

    const toggleBtn = el("button", "staff-toggle-btn");
    toggleBtn.appendChild(img("assets/staff_avatar.svg", "icon-md"));
    const label = el("span", "staff-toggle-label");
    label.appendChild(el("span", "ab-name", s.name));
    label.appendChild(el("span", "lv-badge", `Lv${s.level}`));
    if (!s.alive) label.appendChild(el("span", "tag-done warn-tag", "殉職"));
    else if (!s.sane) label.appendChild(el("span", "tag-done warn-tag", "精神崩壊"));
    else if (s.panic) label.appendChild(el("span", "tag-done warn-tag", "パニック"));
    else label.appendChild(el("span", "mini-hp", `HP ${s.hp.toFixed(0)}/${s.maxHp}`));
    toggleBtn.appendChild(label);
    toggleBtn.appendChild(el("span", "chevron", expanded ? "▲" : "▼"));
    toggleBtn.onclick = () => onToggleExpand(s.id);
    card.appendChild(toggleBtn);

    if (!expanded) {
      container.appendChild(card);
      continue;
    }

    const body = el("div", "staff-body");

    if (!s.alive) {
      body.appendChild(el("div", "warn", "殉職"));
      card.appendChild(body);
      container.appendChild(card);
      continue;
    }
    if (!s.sane) {
      body.appendChild(el("div", "warn", "精神崩壊"));
      card.appendChild(body);
      container.appendChild(card);
      continue;
    }
    if (s.panic) body.appendChild(el("div", "warn", "⚠ パニック状態"));

    const hpRow = el("div", "stat-row");
    hpRow.appendChild(el("span", "stat-label", "HP"));
    hpRow.appendChild(bar(s.hp, s.maxHp, "hp"));
    hpRow.appendChild(el("span", "stat-num", `${s.hp.toFixed(0)}/${s.maxHp}`));
    body.appendChild(hpRow);

    const spRow = el("div", "stat-row");
    spRow.appendChild(el("span", "stat-label", "SP"));
    spRow.appendChild(bar(s.sp, s.maxSp, "sp"));
    spRow.appendChild(el("span", "stat-num", `${s.sp.toFixed(0)}/${s.maxSp}`));
    body.appendChild(spRow);

    const statLine = el(
      "div",
      "stat-line",
      Object.keys(s.stats)
        .map((k) => `${STAT_LABEL[k]}${s.stats[k]}`)
        .join(" / ")
    );
    body.appendChild(statLine);

    const equipLine = el("div", "equip-line");
    equipLine.appendChild(img("assets/ego_weapon.svg", "icon-xs"));
    equipLine.appendChild(document.createTextNode(` ${s.equippedWeapon?.name ?? "なし"}　`));
    equipLine.appendChild(img("assets/ego_armor.svg", "icon-xs"));
    equipLine.appendChild(document.createTextNode(` ${s.equippedArmor?.name ?? "なし"}`));
    body.appendChild(equipLine);

    const weapons = inventory.filter((i) => i.type === "weapon");
    const armors = inventory.filter((i) => i.type === "armor");

    if (weapons.length) {
      const wSelect = el("select", "equip-select");
      wSelect.appendChild(el("option", null, "-- 武器を装備 --"));
      for (const w of weapons) {
        const opt = el("option", null, `${w.name} [${w.rank}/${w.damageType}]`);
        opt.value = w.id;
        wSelect.appendChild(opt);
      }
      wSelect.onchange = () => {
        if (wSelect.value) onEquipWeapon(s.id, wSelect.value);
      };
      body.appendChild(wSelect);
    }
    if (armors.length) {
      const aSelect = el("select", "equip-select");
      aSelect.appendChild(el("option", null, "-- 防具を装備 --"));
      for (const a of armors) {
        const opt = el("option", null, `${a.name} [${a.rank}]`);
        opt.value = a.id;
        aSelect.appendChild(opt);
      }
      aSelect.onchange = () => {
        if (aSelect.value) onEquipArmor(s.id, aSelect.value);
      };
      body.appendChild(aSelect);
    }
    if (!weapons.length && !armors.length) {
      body.appendChild(el("div", "info-row", "（抽出済みE.G.O装備はまだない）"));
    }

    card.appendChild(body);
    container.appendChild(card);
  }
}

export function renderDetailModal(state, abnormalityId, { onUnlock, onExtract, onClose }) {
  const modal = document.getElementById("detail-modal");
  if (!abnormalityId) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
    return;
  }
  const ab = state.abnormalities.find((a) => a.id === abnormalityId);
  if (!ab) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
    return;
  }

  modal.classList.remove("hidden");
  modal.innerHTML = "";

  const observed = ab.unlockedInfo.name;
  const box = el("div", "modal-box");
  const head = el("div", "card-head");
  head.appendChild(rankIconOrUnknown(ab, "icon-xl"));
  const nameWrap = el("div", "name-wrap");
  if (observed) {
    nameWrap.appendChild(rankBadge(ab.rank));
    nameWrap.appendChild(el("h2", null, ab.name));
  } else {
    nameWrap.appendChild(el("h2", null, ab.classCode));
  }
  head.appendChild(nameWrap);
  if (observed) head.appendChild(img(DAMAGE_ICON[ab.damageType], "icon-md", ab.damageType));
  box.appendChild(head);

  if (observed) {
    box.appendChild(el("p", "flavor", ab.flavor));
    box.appendChild(el("p", "info-row", `分類: ${ab.breachType === "escape" ? "脱走型" : "能力発動型"} ／ 属性: ${ab.damageType}`));
  } else {
    const introBox = el("div", "intro-lines");
    for (const line of getIntroLines(ab)) introBox.appendChild(el("div", "intro-line", line));
    box.appendChild(introBox);
  }
  box.appendChild(el("h3", null, `情報ポイント: ${ab.infoPoints}`));

  // ── 情報開示 ──
  box.appendChild(el("h3", null, "情報開示"));
  const nameCost = unlockCost(ab.rank, "name");
  const manualCost = unlockCost(ab.rank, "manual");

  const nameRow = el("div", "unlock-row");
  nameRow.appendChild(el("span", null, `名前を解禁（コスト ${nameCost}）`));
  if (ab.unlockedInfo.name) {
    nameRow.appendChild(el("span", "tag-done", "解禁済み"));
  } else {
    const btn = el("button", "btn small", "解禁する");
    btn.disabled = ab.infoPoints < nameCost;
    btn.onclick = () => onUnlock(ab.id, "name");
    nameRow.appendChild(btn);
  }
  box.appendChild(nameRow);

  const manualRow = el("div", "unlock-row");
  manualRow.appendChild(el("span", null, `管理マニュアルを解禁（コスト ${manualCost}）`));
  if (ab.unlockedInfo.manual) {
    manualRow.appendChild(el("span", "tag-done", "解禁済み"));
  } else {
    const btn = el("button", "btn small", "解禁する");
    btn.disabled = !ab.unlockedInfo.name || ab.infoPoints < manualCost;
    btn.onclick = () => onUnlock(ab.id, "manual");
    manualRow.appendChild(btn);
    if (!ab.unlockedInfo.name) manualRow.appendChild(el("span", "info-row", "（先に名前を解禁）"));
  }
  box.appendChild(manualRow);

  // ── EGO抽出 ──
  box.appendChild(el("h3", null, "E.G.O抽出"));
  const max = egoMaxCount(ab.rank);
  const extracted = ab.egoExtractedCount || 0;
  box.appendChild(el("p", "info-row", `抽出済み: ${extracted} / ${max}（このランクの上限）`));

  if (!ab.unlockedInfo.manual) {
    box.appendChild(el("p", "info-row", "※ 管理マニュアルの解禁が必要"));
  } else if (extracted >= max) {
    box.appendChild(el("p", "info-row", "※ このアブノーマリティからの抽出上限に達した"));
  } else {
    const cost = egoExtractCost(ab.rank);
    const wRow = el("div", "unlock-row");
    wRow.appendChild(img("assets/ego_weapon.svg", "icon-xs"));
    wRow.appendChild(el("span", null, ` 武器として抽出（コスト ${cost}）`));
    const wBtn = el("button", "btn small", "抽出する");
    wBtn.disabled = ab.infoPoints < cost;
    wBtn.onclick = () => onExtract(ab.id, "weapon");
    wRow.appendChild(wBtn);
    box.appendChild(wRow);

    const aRow = el("div", "unlock-row");
    aRow.appendChild(img("assets/ego_armor.svg", "icon-xs"));
    aRow.appendChild(el("span", null, ` 防具として抽出（コスト ${cost}）`));
    const aBtn = el("button", "btn small", "抽出する");
    aBtn.disabled = ab.infoPoints < cost;
    aBtn.onclick = () => onExtract(ab.id, "armor");
    aRow.appendChild(aBtn);
    box.appendChild(aRow);
  }

  const closeBtn = el("button", "btn ghost", "閉じる");
  closeBtn.onclick = onClose;
  box.appendChild(closeBtn);

  modal.appendChild(box);
}

export function renderCombatModal(session, state, { onAssignAndStart, onClose }) {
  const modal = document.getElementById("combat-modal");
  if (!session) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
    return;
  }
  modal.classList.remove("hidden");
  modal.innerHTML = "";

  const box = el("div", "modal-box");
  const titleRow = el("div", "card-head");
  titleRow.appendChild(rankIcon(session.enemyRank, "icon-lg"));
  titleRow.appendChild(el("h2", null, session.started ? `鎮圧戦闘: ${session.enemyName}` : `鎮圧部隊を編成: ${session.enemyName}`));
  box.appendChild(titleRow);

  if (!session.started) {
    box.appendChild(el("p", "flavor", `対象ランク: ${session.enemyRank}。投入する職員を選択してください。`));
    const list = el("div", "assign-list");
    const checkboxes = [];
    for (const s of state.staffList) {
      if (!s.alive || !s.sane) continue;
      const row = el("label", "assign-row");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = s.id;
      checkboxes.push(cb);
      row.appendChild(cb);
      row.appendChild(document.createTextNode(` ${s.name} (Lv${s.level}, HP${s.hp.toFixed(0)}/${s.maxHp})`));
      list.appendChild(row);
    }
    box.appendChild(list);

    const startBtn = el("button", "btn", "鎮圧開始");
    startBtn.onclick = () => {
      const chosen = checkboxes.filter((c) => c.checked).map((c) => c.value);
      if (chosen.length === 0) return;
      onAssignAndStart(chosen);
    };
    box.appendChild(startBtn);
  } else {
    const hpRow = el("div", "stat-row");
    hpRow.appendChild(el("span", "stat-label", "敵HP"));
    hpRow.appendChild(bar(session.enemyHp, session.enemyMaxHp, "enemy"));
    hpRow.appendChild(el("span", "stat-num", `${session.enemyHp.toFixed(0)}/${session.enemyMaxHp}`));
    box.appendChild(hpRow);

    const logBox = el("div", "combat-log");
    for (const line of session.combatLog.slice(0, 30)) {
      logBox.appendChild(el("div", "log-line", line));
    }
    box.appendChild(logBox);

    if (session.finished) {
      const resultText = session.result === "win" ? "✅ 鎮圧成功" : "☠ 鎮圧失敗";
      box.appendChild(el("h3", null, resultText));
      const closeBtn = el("button", "btn", "閉じる");
      closeBtn.onclick = onClose;
      box.appendChild(closeBtn);
    }
  }

  modal.appendChild(box);
}

export function renderCandidateModal(candidates, { onChoose }) {
  const modal = document.getElementById("candidate-modal");
  if (!candidates) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
    return;
  }
  modal.classList.remove("hidden");
  modal.innerHTML = "";

  const box = el("div", "modal-box");
  box.appendChild(el("h2", null, "新たな管理対象を選定"));
  box.appendChild(el("p", "flavor", "3つの不穏な噂の中から、次に収容する幻想体を1体選んでください。"));

  const list = el("div", "candidate-list");
  for (const c of candidates) {
    const card = el("div", "card candidate-card");
    const chead = el("div", "card-head");
    chead.appendChild(img("assets/rank_unknown.svg", "icon-md", "未観測"));
    chead.appendChild(el("span", "class-code", classificationCode(c.id)));
    card.appendChild(chead);
    const introBox = el("div", "intro-lines");
    for (const line of getIntroLines(c)) introBox.appendChild(el("div", "intro-line", line));
    card.appendChild(introBox);
    const chooseBtn = el("button", "btn small", "この幻想体を選ぶ");
    chooseBtn.onclick = () => onChoose(c.id);
    card.appendChild(chooseBtn);
    list.appendChild(card);
  }
  box.appendChild(list);
  modal.appendChild(box);
}

export function renderGameOverBanner(state) {
  const banner = document.getElementById("gameover-banner");
  if (state.cleared) {
    banner.classList.remove("hidden");
    banner.textContent = `🎉 50日間の運営を完遂した。ロボトミー社は今日も静かに稼働を続ける…`;
  } else if (state.gameOver) {
    banner.classList.remove("hidden");
    banner.textContent = `☠ 施設は制御を失った。（${state.day}日目で全滅）`;
  } else {
    banner.classList.add("hidden");
  }
}
