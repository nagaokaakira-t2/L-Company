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

export function renderAbnormalities(state, { onWork, onOpenDetail, selection, onSelectionChange, now }) {
  const container = document.getElementById("abnormality-list");
  container.innerHTML = "";
  const clockNow = now ?? Date.now();

  // 5体ごとに縦列を折り返し、10体（2列）ごとに新しい「段」を作る
  for (let tierStart = 0; tierStart < state.abnormalities.length; tierStart += TIER_CAPACITY) {
    const tierAbs = state.abnormalities.slice(tierStart, tierStart + TIER_CAPACITY);
    const tierIndex = tierStart / TIER_CAPACITY;

    const tierWrap = el("div", "ab-tier");
    tierWrap.appendChild(el("h3", "tier-label", TIER_LABELS[tierIndex] || `収容区画 下段${tierIndex}`));
    const grid = el("div", "ab-tier-grid");
    // 収容数が多いほど段階的に縮小し、横スクロールなしで全体を視認できるようにする
    const scale = Math.max(0.7, 1 - (tierAbs.length - 1) * 0.025);
    grid.style.setProperty("--tier-scale", scale.toFixed(3));

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
        const abOnCooldown = ab.workCooldownUntil && clockNow < ab.workCooldownUntil;

        const staffSelect = el("select", "staff-select");
        staffSelect.dataset.abId = ab.id;
        for (const s of state.staffList) {
          if (!s.alive || !s.sane) continue;
          const onCooldown = s.workCooldownUntil && clockNow < s.workCooldownUntil;
          const opt = el("option", null, `${s.name} (Lv${s.level})${onCooldown ? "［CT］" : ""}`);
          opt.value = s.id;
          if (onCooldown) opt.disabled = true;
          staffSelect.appendChild(opt);
        }
        if (sel.staff && staffSelect.querySelector(`option[value="${sel.staff}"]`)) {
          staffSelect.value = sel.staff;
        }
        staffSelect.onchange = () => onSelectionChange(ab.id, "staff", staffSelect.value);
        staffSelect.disabled = abOnCooldown;

        const workSelect = el("select", "work-select");
        for (const w of WORK_TYPES) {
          const opt = el("option", null, WORK_LABEL[w]);
          opt.value = w;
          // 好む作業は名前解禁で、苦手な作業はマニュアル解禁で判明する
          if (ab.unlockedInfo.name && w === ab.preferredWork) opt.textContent += " ◎";
          if (ab.unlockedInfo.manual && w === ab.dislikedWork) opt.textContent += " ×";
          workSelect.appendChild(opt);
        }
        if (sel.work) workSelect.value = sel.work;
        workSelect.onchange = () => onSelectionChange(ab.id, "work", workSelect.value);
        workSelect.disabled = abOnCooldown;

        const workBtn = el("button", "btn small", abOnCooldown ? "CT中" : "作業実行");
        workBtn.disabled = abOnCooldown;
        workBtn.onclick = () => {
          if (!staffSelect.value) return;
          onWork(staffSelect.value, ab.id, workSelect.value);
        };

        const controls = el("div", "controls");
        controls.appendChild(staffSelect);
        controls.appendChild(workSelect);
        controls.appendChild(workBtn);
        card.appendChild(controls);
        if (abOnCooldown) card.appendChild(el("div", "ct-tag", "この幻想体はCT中（作業不可）"));

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

export function renderStaff(state, { onEquipWeapon, onEquipArmor, expandedIds, onToggleExpand, now }) {
  const container = document.getElementById("staff-list");
  container.innerHTML = "";
  const inventory = state.egoInventory || [];
  const clockNow = now ?? Date.now();

  // 他の職員が現在装備中のアイテムIDを集計（1点の抽出装備は同時に1人しか使えない）
  const equippedByOthers = (excludeStaffId, field) => {
    const ids = new Set();
    for (const other of state.staffList) {
      if (other.id === excludeStaffId) continue;
      const item = other[field];
      if (item) ids.add(item.id);
    }
    return ids;
  };

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
    else {
      label.appendChild(el("span", "mini-hp", `HP ${s.hp.toFixed(0)}/${s.maxHp}`));
      if (s.workCooldownUntil && clockNow < s.workCooldownUntil) {
        label.appendChild(el("span", "ct-tag", "CT"));
      }
    }
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

    const weapons = inventory.filter(
      (i) => i.type === "weapon" && !equippedByOthers(s.id, "equippedWeapon").has(i.id)
    );
    const armors = inventory.filter(
      (i) => i.type === "armor" && !equippedByOthers(s.id, "equippedArmor").has(i.id)
    );

    if (weapons.length) {
      const wSelect = el("select", "equip-select");
      wSelect.appendChild(el("option", null, "-- 武器を装備 --"));
      for (const w of weapons) {
        const opt = el("option", null, `${w.name} [${w.rank}/${w.damageType}]`);
        opt.value = w.id;
        wSelect.appendChild(opt);
      }
      if (s.equippedWeapon && wSelect.querySelector(`option[value="${s.equippedWeapon.id}"]`)) {
        wSelect.value = s.equippedWeapon.id;
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
      if (s.equippedArmor && aSelect.querySelector(`option[value="${s.equippedArmor.id}"]`)) {
        aSelect.value = s.equippedArmor.id;
      }
      aSelect.onchange = () => {
        if (aSelect.value) onEquipArmor(s.id, aSelect.value);
      };
      body.appendChild(aSelect);
    }
    if (!weapons.length && !armors.length) {
      body.appendChild(el("div", "info-row", "（装備可能なE.G.O装備がない。抽出済みで他の職員が使用中の可能性あり）"));
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

  // ── 作業傾向: 好む作業は名前解禁で判明。苦手な作業はマニュアル解禁まで不明のまま ──
  box.appendChild(el("h3", null, "作業傾向"));
  if (observed) {
    box.appendChild(el("p", "info-row", `好む作業: ${WORK_LABEL[ab.preferredWork]}`));
    if (ab.unlockedInfo.manual) {
      box.appendChild(el("p", "info-row", `苦手な作業: ${WORK_LABEL[ab.dislikedWork]}`));
    } else {
      box.appendChild(el("p", "info-row", "苦手な作業: ???（管理マニュアル解禁で判明）"));
    }
  } else {
    box.appendChild(el("p", "info-row", "作業傾向は未観測（名前の解禁が必要）"));
  }

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

  // ── EGO抽出（武器・防具は別枠でそれぞれ上限までカウント）──
  box.appendChild(el("h3", null, "E.G.O抽出"));
  const max = egoMaxCount(ab.rank);
  const weaponExtracted = ab.egoExtractedWeaponCount || 0;
  const armorExtracted = ab.egoExtractedArmorCount || 0;
  box.appendChild(el("p", "info-row", `武器 抽出済み: ${weaponExtracted} / ${max}　防具 抽出済み: ${armorExtracted} / ${max}`));

  if (!ab.unlockedInfo.manual) {
    box.appendChild(el("p", "info-row", "※ 管理マニュアルの解禁が必要"));
  } else {
    const cost = egoExtractCost(ab.rank);

    const wRow = el("div", "unlock-row");
    wRow.appendChild(img("assets/ego_weapon.svg", "icon-xs"));
    if (weaponExtracted >= max) {
      wRow.appendChild(el("span", null, ` 武器として抽出（上限に到達）`));
      wRow.appendChild(el("span", "tag-done", "上限"));
    } else {
      wRow.appendChild(el("span", null, ` 武器として抽出（コスト ${cost}）`));
      const wBtn = el("button", "btn small", "抽出する");
      wBtn.disabled = ab.infoPoints < cost;
      wBtn.onclick = () => onExtract(ab.id, "weapon");
      wRow.appendChild(wBtn);
    }
    box.appendChild(wRow);

    const aRow = el("div", "unlock-row");
    aRow.appendChild(img("assets/ego_armor.svg", "icon-xs"));
    if (armorExtracted >= max) {
      aRow.appendChild(el("span", null, ` 防具として抽出（上限に到達）`));
      aRow.appendChild(el("span", "tag-done", "上限"));
    } else {
      aRow.appendChild(el("span", null, ` 防具として抽出（コスト ${cost}）`));
      const aBtn = el("button", "btn small", "抽出する");
      aBtn.disabled = ab.infoPoints < cost;
      aBtn.onclick = () => onExtract(ab.id, "armor");
      aRow.appendChild(aBtn);
    }
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
  const waveTag = session.waveTotal ? `（波 ${session.waveNum}/${session.waveTotal}）` : "";
  titleRow.appendChild(
    el("h2", null, (session.started ? `鎮圧戦闘: ${session.enemyName}` : `鎮圧部隊を編成: ${session.enemyName}`) + waveTag)
  );
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

export function renderDayEndScreen(state, dayEndState, { onHire, onRename, onContinue, onCancel }) {
  const modal = document.getElementById("dayend-modal");
  if (!dayEndState) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
    return;
  }
  modal.classList.remove("hidden");
  modal.innerHTML = "";

  const box = el("div", "modal-box");
  if (dayEndState.mode === "recovery") {
    box.appendChild(el("h2", null, "☠ 施設は制御を失った"));
    box.appendChild(
      el("p", "flavor", `稼働可能な職員がいなくなった。新たな職員を雇用し、${state.day}日目をやり直す。`)
    );
  } else if (dayEndState.mode === "rewind") {
    box.appendChild(el("h2", null, "⏪ 時間遡行技術"));
    box.appendChild(
      el(
        "p",
        "flavor",
        `${state.day}日目の開始時点まで状態を巻き戻します。今日中に行った作業の成果・職員の被害（死亡や精神崩壊を含む）は全て元に戻ります。既に解禁した観測情報・抽出済みのE.G.O・獲得済みのレベルは失われません。今日新しく雇用した職員は消滅します。`
      )
    );
    const confirmBtn = el("button", "btn", "時間遡行を発動する");
    confirmBtn.onclick = onContinue;
    box.appendChild(confirmBtn);
    const cancelBtn = el("button", "btn ghost", "キャンセル");
    cancelBtn.onclick = onCancel;
    box.appendChild(cancelBtn);
    modal.appendChild(box);
    return;
  } else {
    box.appendChild(el("h2", null, `${state.day}日目 終了処理`));
    box.appendChild(el("p", "flavor", "職員の雇用・改名を行い、準備ができたら次の日へ進んでください。"));
  }

  const hireBtn = el("button", "btn", "職員を雇用する（上限12名）");
  hireBtn.disabled = state.staffList.length >= 12;
  hireBtn.onclick = onHire;
  box.appendChild(hireBtn);

  box.appendChild(el("h3", null, "職員一覧（改名可）"));
  const staffListEl = el("div", "dayend-staff-list");
  for (const s of state.staffList) {
    const row = el("div", "dayend-staff-row");
    row.appendChild(img("assets/staff_avatar.svg", "icon-sm"));
    if (s.alive) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = s.name;
      input.maxLength = 12;
      input.className = "rename-input";
      input.disabled = !s.alive;
      input.onchange = () => onRename(s.id, input.value);
      row.appendChild(input);
    } else {
      row.appendChild(el("span", "ab-name", s.name));
    }
    row.appendChild(el("span", "lv-badge", `Lv${s.level}`));
    if (!s.alive) row.appendChild(el("span", "tag-done warn-tag", "殉職"));
    else if (!s.sane) row.appendChild(el("span", "tag-done warn-tag", "精神崩壊"));
    staffListEl.appendChild(row);
  }
  box.appendChild(staffListEl);

  const canContinue = state.staffList.some((s) => s.alive && s.sane);
  const contBtn = el("button", "btn", dayEndState.mode === "recovery" ? "この日をやり直す" : "次の日へ進む");
  contBtn.disabled = !canContinue;
  contBtn.onclick = onContinue;
  box.appendChild(contBtn);
  if (!canContinue) box.appendChild(el("p", "info-row", "※ 稼働可能な職員が1人もいないため進められない"));

  modal.appendChild(box);
}

export function renderCodexModal(state, isOpen, { onClose }) {
  const modal = document.getElementById("codex-modal");
  if (!isOpen) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
    return;
  }
  modal.classList.remove("hidden");
  modal.innerHTML = "";

  const box = el("div", "modal-box");
  box.appendChild(el("h2", null, "図鑑（これまでに観測した幻想体）"));

  const observed = state.abnormalities.filter((a) => a.unlockedInfo.name);
  if (observed.length === 0) {
    box.appendChild(el("p", "flavor", "まだ観測（名前解禁）済みの幻想体がいない。"));
  } else {
    const list = el("div", "codex-list");
    for (const ab of observed) {
      const row = el("div", "codex-row");
      row.appendChild(rankIcon(ab.rank, "icon-md"));
      const info = el("div", "name-wrap");
      const head = el("div", "card-head");
      head.appendChild(rankBadge(ab.rank));
      head.appendChild(el("span", "ab-name", ab.name));
      info.appendChild(head);
      info.appendChild(el("p", "flavor", ab.flavor));
      info.appendChild(el("span", "info-row", `分類: ${ab.classCode} ／ 属性: ${ab.damageType} ／ ${ab.breachType === "escape" ? "脱走型" : "能力発動型"}`));
      row.appendChild(info);
      list.appendChild(row);
    }
    box.appendChild(list);
  }

  const closeBtn = el("button", "btn ghost", "閉じる");
  closeBtn.onclick = onClose;
  box.appendChild(closeBtn);

  modal.appendChild(box);
}

export function renderGameOverBanner(state) {
  const banner = document.getElementById("gameover-banner");
  if (state.cleared) {
    banner.classList.remove("hidden");
    banner.textContent = `🎉 50日間の運営を完遂した。ロボトミー社は今日も静かに稼働を続ける…`;
  } else {
    banner.classList.add("hidden");
  }
}
