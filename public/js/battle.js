

let isHost = false;

const battleStats = {
  win: 0,
  lose: 0,
  draw: 0
};

let currentRoomId = null;
let socket = null;
let isReady = false;
let opponentReady = false; // 相手の準備完了状態

let lastBattleResult = null;

let turnNumber = 0; // 経過ターン
let BattleCheck = false 
let isFirstPlayer = false;

let selectedDetailCard = null;
// 🔽 グローバルスコープで定義（ファイル上部推奨）
let nextInstanceId = 1;

// ルール設定
let matchSettings = {
  maxHP: 30,
  initialPP: 1,
  ppGainPerTurn: 1,
  initialHand: 4,
  maxPP: 10,
  firstPlayerMethod: "host", // "host" / "guest" / "random"
	firstPlayerDraws: true,
};

const initialPlayerState = {
  localPlayerDeck: [], // 使用デッキ変更しない
  playerHand: [], // 手札
  graveyard: [], // 捨て札
  field: [], // フィールドに出ているカード
  exDeck: [], // EXデッキ（任意）
  life: 30, // ライフ
  pp: 0, // プレイポイント
  maxpp: 1,
  drawPile: [], // シャッフル済みデッキ
  // 追加：状態フラグなど
  isTurn: true,

  // 🔽 追加分
  status: {
    drawBonus: 0, // ドロー枚数補正
    costReduction: 0, // カードプレイ時のコスト軽減
    atkBoost: 0, // 全体ATK上昇
    hpBoost: 0, // 全体HP上昇
    immune: [], // 無効化される効果（例: ["破壊", "バウンス"]）
    passiveEffects: [], // 永続型スキルのIDや名称
    oncePerTurnFlags: {}, // 1ターン1回制限の行動フラグ
  },

  settings: {
    deckName: "", // 現在使用しているデッキ名
    username: "", // 表示用プレイヤー名
    controlType: "player", // "player" or "AI"
    autoPlay: false, // オートプレイ機能（将来的なCPU処理）
    animation: true, // エフェクト表示の有無
  },
};


const exampleCard = {
  id: "C001", // 一意の識別子（固定ID or 複製時の連番）
  name: "ファーマー", // 名前
  cost: 1,
  atk: 1,
  hp: 2,
  type: "キャラ", // 分類（キャラ・施設・マジック等）

  owner: "player", // 所有者（"player" or "enemy"）
  zone: "hand", // 現在の位置（deck, hand, field, grave, ex）
  state: {
    exhausted: false, // 疲労状態（行動済みか）
    hidden: false, // 裏向きか（非公開）
    buffs: [], // 一時的バフ（+ATKなど）
    disabled: false, // 能力無効など
  },

  abilityText: "～", // 表示用の能力説明
  effects: [], // 実際の効果処理（スクリプト or ID）
  tags: [], // 種族・職業・属性など（例: ["人間", "農民"]）

  illustration: "ファーマー", // 画像ファイル名
};

const playerState = JSON.parse(JSON.stringify(initialPlayerState));

let enemyState = JSON.parse(JSON.stringify(initialPlayerState));

// タブ切り替え機能
function switchCardDetailTab(tabName, clickedButton) {
  // ボタンのアクティブ切替
  document.querySelectorAll("#card-detail-tabs .tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });
  clickedButton.classList.add("active");

  // コンテンツの表示切替
  document
    .querySelectorAll("#card-detail-content .tab-content")
    .forEach((content) => {
      content.classList.remove("active");
    });

  const target = document.getElementById(`tab-content-${tabName}`);
  if (target) {
    target.classList.add("active");
  }
}

// ==============================
// ターン処理 
// ==============================

// ターン開始
function startTurn() {
  if (!playerState.isTurn || playerState.turnStarted) return;

  playerState.turnStarted = true;
  turnNumber++;

  if (playerState.maxpp < 10) {
    playerState.maxpp++;
  }
  playerState.pp = playerState.maxpp;

	if (!(turnNumber === 1 && isFirstPlayer && !matchSettings.firstPlayerDraws)) {
		drawCard();
	}
	
  renderCostBar(playerState.pp, playerState.maxpp);
  updateLifeDisplay();
  updateZoneCounts(playerState, "player-ui-bar");

  showTurnDialog(playerState.settings.username);
  updateTurnButtons(); // 🔄 ボタン制御
	closeControlPanel()
}

// ターン終了
function endTurn() {
  if (!playerState.isTurn || !playerState.turnStarted) return;

  playerState.isTurn = false;
  playerState.turnStarted = false;

  sendWebRTCData({
    type: "turnPassed",
    from: userId,
    username: username
  });

  showTurnDialog(enemyState.settings.username);
  updateTurnButtons();
	closeControlPanel()
}

// ボタン制御
function updateTurnButtons() {
  const startBtn = document.querySelector('button[onclick="startTurn()"]');
  const endBtn = document.querySelector('button[onclick="endTurn()"]');

  const canStart = playerState.isTurn && !playerState.turnStarted;
  const canEnd = playerState.isTurn && playerState.turnStarted;

  if (startBtn) startBtn.disabled = !canStart;
  if (endBtn) endBtn.disabled = !canEnd;
}


// どちらのターンか表示する
function showTurnDialog(playerName) {
  const turnInfo = `${turnNumber}ターン目`; // ← 🔧 これが必要
	const roleInfo = isFirstPlayer ? "（先行）" : "（後攻）";

  // 常時表示バーの更新
  const fixed = document.getElementById("turn-indicator");
  if (fixed) {
    fixed.textContent = `${turnInfo} ${roleInfo} ${playerName}のターン`;
  }

  // ターンチェンジ演出（中央横スクロール）
  const banner = document.getElementById("turn-change-banner");
  if (banner) {
    banner.style.animation = "none"; // リセット
    banner.offsetHeight; // 再描画強制
    banner.style.animation = "slideAcross 3s ease-out";
  }
}

// ターンのボタンのONOFF
function toggleTurnButtons() {
  const startBtn = document.querySelector('button[onclick="startTurn()"]');
  const endBtn = document.querySelector('button[onclick="endTurn()"]');

  const canStart = playerState.isTurn && !playerState.turnStarted;
  const canEnd = playerState.isTurn && playerState.turnStarted;

  if (startBtn) startBtn.disabled = !canStart;
  if (endBtn) endBtn.disabled = !canEnd;
}


// 受信したデータを元にUIを変更
function addOpponentToUI(player) {
  // 名前
  if (player.username) {
    document.getElementById("opponent-name").textContent = player.username;
  }

  // デッキ名
  if (player.deckName || player.selectedDeckName) {
    document.getElementById("opponent-deck-label").textContent =
      player.deckName || player.selectedDeckName;
  }

  // 状態（準備完了かどうか）
  if (player.isReady) {
    document.getElementById("opponent-status").textContent = "準備完了";
    document.getElementById("opponent-status").style.color = "#0f0"; // 緑
  } else {
    document.getElementById("opponent-status").textContent = "未準備";
    document.getElementById("opponent-status").style.color = "#f33"; // 赤
  }
}

// デッキを画面にセット
function updateSelectedDeckDisplay() {
  const label = document.getElementById("self-deck-label");
  if (label && selectedDeckName) {
    label.textContent = selectedDeckName;
  }

	// 名前を登録
	playerState.settings.username = username
}


// ==============================
// パネル ボタンの調整
// ==============================

// 操作パネルを表示
function togglePlayerControlPanel() {
  const panel = document.getElementById("player-control-panel");
  if (!panel) return;

  const isVisible = panel.style.display === "block";
  panel.style.display = isVisible ? "none" : "block";
  console.log("操作パネルを", isVisible ? "閉じる" : "開く");
}

// battle開始処理
async function battleStart() {
  console.log("バトルスタートのボタンが押された", selectedDeckId);


  // 初期化
  // 設定を反映
  playerState.life = matchSettings.maxHP;
  playerState.pp = matchSettings.initialPP - 1;
  playerState.maxpp = playerState.pp;
  playerState.ppGainPerTurn = matchSettings.ppGainPerTurn || 1; // 任意
  turnNumber = 0;

  renderCostBar(0, 0);

  updateLifeDisplay();
  updateSelectedDeckDisplay();


  // 先行後攻の判定
  switch (matchSettings.firstPlayerMethod) {
    case "host":
      isFirstPlayer = isHost;
      break;
    case "guest":
      isFirstPlayer = !isHost;
      break;
    case "random":
      isFirstPlayer = Math.random() < 0.5;
      break;
  }

	console.log("battleStart isFirstPlayer :", isFirstPlayer)

  const matchedDeck = deckList.find(deck => deck._id === selectedDeckId);
  if (!matchedDeck) {
    console.error("デッキが見つかりません");
    return;
  }
  // EXと通常カードを分離
  const exDeck = [];
  const drawPile = [];

  for (const card of expandDeckStructure(matchedDeck.deck, cardList)) {
    if (card.レアリティ === "EX") {
      exDeck.push(card);
    } else {
      drawPile.push(card);
    }
  }

  // 状態に反映
  playerState.exDeck = exDeck;
  playerState.drawPile = shuffleDeck(drawPile);

  console.log("展開されたデッキ：", playerState.drawPile);

  // 初期手札
  for (let i = 0; i < matchSettings.initialHand; i++) {
    drawCard();
  }

  // 先行・後攻を決定
  if (isFirstPlayer) {
    playerState.isTurn = true;
    enemyState.isTurn = false;
    playerState.turnStarted = false;
    await showTurnDialog(username); // ← 自分が先行なので自分の名前
  } else {
    playerState.isTurn = false;
    enemyState.isTurn = true;
    playerState.turnStarted = false;
    await showTurnDialog(enemyState.settings.username); // 相手が先行
  }

  updateTurnButtons(); // ← ボタンの有効・無効を制御
}

// battle.js（バトル終了処理と勝敗チェック）
function endBattle(reason = "バトル終了") {
  console.log("バトル終了:", reason);

  let result = "draw";
  if (reason.includes("勝利")) result = "win";
  else if (reason.includes("敗北")) result = "lose";

  // 相手に逆の結果を送信
  const inverseResult = result === "win" ? "lose" : result === "lose" ? "win" : "draw";
	
  // カウント更新
  if (result === "win") battleStats.win++;
  else if (result === "lose") battleStats.lose++;
  else battleStats.draw++;

  console.log(`勝利:${battleStats.win} 敗北:${battleStats.lose} 引き分け:${battleStats.draw}`);

  sendWebRTCData({
    type: "battleEnd",
    result: inverseResult,
    reason: reason
  });



  // 状態リセットなど（必要に応じて）
  initDeckState();
	updateWinDisplay()
	resetBattleUI()
}
function updateWinDisplay() {
  const selfSpan = document.getElementById("self-win-count");
  const opponentSpan = document.getElementById("opponent-win-count");
  if (!selfSpan || !opponentSpan) return;

  selfSpan.textContent = battleStats.win;
  opponentSpan.textContent = battleStats.lose;
}


// バトル終了時の勝敗チェック
function checkBattleEnd() {
  const confirmExit = confirm("バトルを終了してよろしいですか？");
  if (!confirmExit) return;
	closeControlPanel()

  // 両者ともHPが残っている（同時ターン終了など）
  if (playerState.life > 0 && enemyState.life > 0) {
    if (playerState.life < enemyState.life) {
      endBattle("あなたの敗北");
    } else if (enemyState.life < playerState.life) {
      endBattle("あなたの勝利");
    } else {
      endBattle("引き分け");
    }
  }
  // 通常のHP0チェック
  else if (playerState.life <= 0 && enemyState.life > 0) {
    endBattle("あなたの敗北");
  } else if (enemyState.life <= 0 && playerState.life > 0) {
    endBattle("あなたの勝利");
  } else if (playerState.life <= 0 && enemyState.life <= 0) {
    endBattle("相打ち（引き分け）");
  }
}

// 勝敗結果の保存処理
function updateWinLoss(result) {
  const key = `battle_${result}`;
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  localStorage.setItem(key, current + 1);
}


function initDeckState() {
  playerState.drawPile = playerState.localPlayerDeck;
  playerState.playerHand = [];
  playerState.graveyard = [];
  playerState.field = [];
  playerState.exDeck = [];
	playerState.life = matchSettings.maxHP;
  playerState.pp = matchSettings.initialPP - 1;
  playerState.maxpp = playerState.pp;
  playerState.ppGainPerTurn = matchSettings.ppGainPerTurn || 1; // 任意
  turnNumber = 0;
}
function initStatusFlags(playerState) {
  playerState.status = {
    drawBonus: 0,
    costReduction: 0,
    atkBoost: 0,
    hpBoost: 0,
    immune: [],
    passiveEffects: [],
    oncePerTurnFlags: {}
  };
}
function initPlayerSettings(playerState, username, deckName) {
  playerState.settings = {
    deckName: deckName || "",
    username: username || "",
    controlType: "player",
    autoPlay: false,
    animation: true
  };
}

// パネルを閉じる
function closeControlPanel() {
  const panel = document.getElementById("player-control-panel");
  if (panel) panel.style.display = "none";
}

// タブ切り替え
function showBattlePanelTab(tabId) {
  document.querySelectorAll(".battle-panel-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  const target = document.getElementById(`battle-tab-${tabId}`);
  if (target) {
    target.classList.add("active");
  } else {
    console.warn(`battle-tab-${tabId} が見つかりません`);
  }
}

// カード詳細を表示する
function openCardDetail(card, options = "手札") {
	console.log("カード詳細を表示する :", card)
  const panel = document.getElementById("card-detail-panel");

  let zones;

  if (options.startsWith("敵の")) {
    zones = [
      enemyState.field,
      enemyState.playerHand
    ];
    panel.style.top = "32%";
  } else {
    zones = [
      playerState.playerHand,
      playerState.drawPile,
      playerState.graveyard,
      playerState.exDeck,
      playerState.field,
      tokenCard
    ];
    panel.style.top = "1%";
  }

	const realCard = zones.flat().find(c => c.instanceId === card.instanceId);
  if (!realCard) {
    console.warn("選択されたカードが playerState に存在しません");
    return;
  }

  selectedDetailCard = realCard;

  const abilityEl = document.getElementById("card-detail-ability");

  // ステータス構築（値があるものだけを表示）
  const statusParts = [];
  if (card.コスト != null) statusParts.push(`コスト: ${card.コスト}`);
  if (card.HP != null) statusParts.push(`HP: ${card.HP}`);
  if (card.ATK != null) statusParts.push(`ATK: ${card.ATK}`);
  document.getElementById("card-detail-status").textContent =
    statusParts.join("　"); // 全角スペース区切り

  // 各テキストをセット
  document.getElementById("card-detail-name").textContent = card.名前 || "";
  fitTextToContainer(document.getElementById("card-detail-name"));
  document.getElementById("card-detail-type").textContent = `${
    card.種族1 || ""
  } ／ ${card.職業1 || ""}`;
  fitTextToContainer(document.getElementById("card-detail-type"), 14, 8);

  // document.getElementById("card-detail-ability").textContent = card.能力説明 || '効果なし';
  // 効果説明を行ごとに分割（さらに "/" でも改行）
  // " / " を改行しつつ記録
  const rawText = card.能力説明 || "効果なし";
  const rawLines = rawText.split(/\r?\n/).flatMap((line) =>
    line.includes(" / ")
      ? line.split(/\s+\/\s+/).map((part, i) => ({
          text: part,
          isSub: i > 0,
        }))
      : [{ text: line, isSub: false }]
  );

  // 能力名グループを取得
  const conditionNames =
    abilityDetails["条件名"]?.map((row) => row.能力名) || [];
  const attackNames =
    abilityDetails["アタック系"]?.map((row) => row.能力名) || [];
  const defenseNames = abilityDetails["防御系"]?.map((row) => row.能力名) || [];

  abilityEl.innerHTML = rawLines
    .map(({ text, isSub }) => {
      let highlightedLine = text;

      // 条件名をゴールドに
      conditionNames.forEach((name) => {
        if (name && highlightedLine.includes(name)) {
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedName, "g");
          highlightedLine = highlightedLine.replace(
            regex,
            `<span class="highlight-ability">${name}</span>`
          );
        }
      });

      // アタック系（薄赤）
      attackNames.forEach((name) => {
        if (name && highlightedLine.includes(name)) {
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedName, "g");
          highlightedLine = highlightedLine.replace(
            regex,
            `<span class="highlight-attack">${name}</span>`
          );
        }
      });

      // 防御系（薄青）
      defenseNames.forEach((name) => {
        if (name && highlightedLine.includes(name)) {
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedName, "g");
          highlightedLine = highlightedLine.replace(
            regex,
            `<span class="highlight-defense">${name}</span>`
          );
        }
      });

      // ATK を赤、HP を緑に
      highlightedLine = highlightedLine
        .replace(/\bATK\b/g, `<span class="stat-atk">ATK</span>`)
        .replace(/\bHP\b/g, `<span class="stat-hp">HP</span>`);

      const lineClass = isSub ? "ability-line sub-line" : "ability-line";
      return `<div class="${lineClass}">${highlightedLine}</div>`;
    })
    .join("");

  renderCardMoveOptions(options, card.ID);
  // 背景画像を card-detail-panel に設定
  document.getElementById(
    "card-detail-img"
  ).src = `assets/images/illust/${card.画像}.webp`;

  // パネルを表示
  panel.style.display = "block";
}

// カードステータス変更
async function adjustCardStat(stat, delta) {
  if (!selectedDetailCard) return;

  const zones = [
    playerState.playerHand,
    playerState.drawPile,
    playerState.graveyard,
    playerState.exDeck,
    playerState.field,
  ];

  let updatedCard = null;

  for (const zone of zones) {
    const target = zone.find(c => c.instanceId === selectedDetailCard.instanceId);
    if (target) {
      // 更新対象を決定
      updatedCard = target;

      // ステータス更新（1回のみ）
      if (stat === "HP") {
        updatedCard.HP = Number(updatedCard.HP || 0) + delta;
      } else if (stat === "ATK") {
        updatedCard.ATK = Number(updatedCard.ATK || 0) + delta;
      }

      break;
    }
  }

  // ステータス表示更新（更新されたものを使う）
  if (updatedCard) {
    const statusParts = [];
    if (updatedCard.コスト != null) statusParts.push(`コスト: ${updatedCard.コスト}`);
    if (updatedCard.ATK != null)    statusParts.push(`ATK: ${updatedCard.ATK}`);
    if (updatedCard.HP != null)     statusParts.push(`HP: ${updatedCard.HP}`);
    document.getElementById("card-detail-status").textContent =
      statusParts.join("　");

    // selectedDetailCard にも反映（参照が違う場合用）
    selectedDetailCard.ATK = updatedCard.ATK;
    selectedDetailCard.HP  = updatedCard.HP;
  }
	await updateCardZoneDisplay("手札");
}

// カードの位置を見つける
function findCardCurrentZone(card) {
  const zones = {
    "手札": playerState.playerHand,
    "デッキ": playerState.drawPile,
    "捨て札": playerState.graveyard,
    "EXデッキ": playerState.exDeck,
    "場": playerState.field,
    "トークン": tokenCard
  };

  for (const [zoneName, zoneArray] of Object.entries(zones)) {
    if (zoneArray.some(c => c.instanceId === card.instanceId)) {
      return zoneName;
    }
  }

  return null; // 見つからなければ null
}

//空いている場を確認 
function getAvailableFieldSlots() {
  const allSlots = ["p0", "p1", "p2", "p3", "p4", "p5"];
  const used = new Set(playerState.field.map(card => card.position));
  return allSlots.filter(slot => !used.has(slot));
}


//カード移動を行うパネル
function renderCardMoveOptions(currentLocation) {
	const container = document.getElementById("card-move-options");

  // 敵の場のカードは移動不可（ボタン非表示）
  if (currentLocation === "敵の場") {
    const notice = document.createElement("div");
    notice.textContent = "このカードは移動できません（敵の場）";
    notice.style.color = "#ccc";
    notice.style.textAlign = "center";
    notice.style.fontSize = "0.9em";
    container.appendChild(notice);
    return;
  }

  const allZones = ["手札", "場", "デッキ", "捨て札", "EX"];
  const targetZones = allZones.filter(loc => loc !== currentLocation);


  container.innerHTML = '';

  const fieldLimit = 6;

  targetZones.forEach(dest => {
    const btn = document.createElement("button");
    btn.textContent = `${dest}に移動`;
    btn.onclick = () => {
      if (dest === "場" && (playerState.field?.length || 0) >= fieldLimit) {
        alert("フィールドが満杯です。カードをこれ以上配置できません。");
        return;
      }
      moveCardToLocation(dest);
    };
    container.appendChild(btn);
  });
}

// カードを移動させる
function moveCardToLocation(destination) {
  console.log("カードを移動させる destination : ", destination, selectedDetailCard);

  if (!selectedDetailCard) {
    console.warn("移動対象のカードが不明です");
    return;
  }

  const zones = {
    "手札": playerState.playerHand,
    "デッキ": playerState.drawPile,
    "捨て札": playerState.graveyard,
    "EX": playerState.exDeck,
    "場": playerState.field
  };
  const allZones = Object.values(zones);

  let currentZoneName = findCardCurrentZone(selectedDetailCard);
  let found = false;

  // 1. 既に instanceId がある → 通常削除処理
  if (selectedDetailCard.instanceId) {
    for (const zone of allZones) {
      const index = zone.findIndex(c => c.instanceId === selectedDetailCard.instanceId);
      if (index !== -1) {
        zone.splice(index, 1);
        found = true;
        break;
      }
    }

    if (!found && selectedDetailCard.分類1 !== "トークン") {
      console.warn("カードが移動元から見つかりませんでした");
      return;
    }
  }

  // 2. instanceId がなければここで付与（例: トークン）
  if (!selectedDetailCard.instanceId) {
    selectedDetailCard.instanceId = generateUUID(); // crypto.randomUUID() ではなく代替版を使用
    console.log("新規 instanceId を付与:", selectedDetailCard.instanceId);
  }

  // 3. 特別処理：手札 → 場
  if (currentZoneName === "手札" && destination === "場") {
    playCardFromHandToField(selectedDetailCard, currentZoneName);
    return;
  }

  // 4. 通常のゾーン移動
  const targetZone = zones[destination];
  if (!targetZone) {
    console.warn("無効な移動先:", destination);
    return;
  }

  targetZone.push(selectedDetailCard);
  closeCardDetail();
  afterCardMoveUpdate(currentZoneName, destination);
}




// カードのUIを更新
function afterCardMoveUpdate(currentZoneName, destination) {
  closeCardDetail();

  // ラベルの切り替え（オプション）
  const zoneLabel = document.getElementById("player-zone-label");
  if (zoneLabel) {
    zoneLabel.textContent = destination === "場" ? "場" :
                            destination === "手札" ? "手札" :
                            zoneLabel.textContent; // それ以外は変えない
  }

  // 🟡 手札↔場 のときだけ手札を更新
  const isHandAndFieldSwap =
    (currentZoneName === "手札" && destination === "場") ||
    (currentZoneName === "場" && destination === "手札");

  if (isHandAndFieldSwap) {
    updateCardZoneDisplay("手札");
  } else {
    // それ以外は現在表示中のゾーンを更新（ラベルと連動させている前提）
    updateCardZoneDisplay(currentZoneName);
  }

  // フィールドは常に更新
  renderField();
}


// プレイ時の処理
function playCardFromHandToField(card, currentZoneName) {
  const availableSlots = getAvailableFieldSlots();

  if (availableSlots.length === 0) {
    alert("フィールドが満杯です。");
    return;
  }

  const buttons = availableSlots.map(pos => ({
    label: pos.toUpperCase(),
    onClick: () => {
      card.position = pos;
      playerState.field.push(card);
      closeUniversalModal();
      afterCardMoveUpdate("手札", "場");
    }
  }));

  openUniversalModal({
    title: "配置するスロットを選んでください",
    content: "フィールドに出す位置を選択します。",
    buttons,
    vertical: false,
    backgroundOpacity: 0.9
  });
}

// 枚数をカウント
function updateZoneCounts(state, uiBarId) {
	// // プレイヤーのUIを更新
	// updateZoneCounts(playerState, "player-ui-bar");
	// // 敵のUIを更新（enemy-ui-bar 側のDOM構造が同じであることが前提）
	// updateZoneCounts(enemyState, "enemy-ui-bar");
  const zones = {
    "手札":    { data: state.playerHand,   className: "player-hand-icon" },
    "デッキ":  { data: state.drawPile,     className: "player-deck-card" },
    "捨て札":  { data: state.graveyard,    className: "player-discard-icon" },
    "EXデッキ": { data: state.exDeck,      className: "player-ex-card" }
  };

  const root = document.getElementById(uiBarId);
  if (!root) {
    console.warn(`UIバーが見つかりません: ${uiBarId}`);
    return;
  }

  for (const key in zones) {
    const { data, className } = zones[key];
    const container = root.querySelector(`.${className} .deck-count`);
    if (container) {
      container.textContent = data.length;
    } else {
      console.warn(`要素が見つかりません: ${className}（in ${uiBarId}）`);
    }
  }
}


// 文字大きさ調整
function fitTextToContainer(element, maxFontSize = 20, minFontSize = 10) {
  const containerWidth = element.offsetWidth;
  let fontSize = maxFontSize;
  element.style.fontSize = fontSize + "px";

  while (element.scrollWidth > containerWidth && fontSize > minFontSize) {
    fontSize -= 1;
    element.style.fontSize = fontSize + "px";
  }
}

// カード情報パネルを出す
function closeCardDetail() {
  document.getElementById("card-detail-panel").style.display = "none";
}
//==================================================
// コマンド操作用
//==================================================

// HP操作 
function adjustHP(amount) {
  const max = playerState.maxlife || 30; // デフォルト最大値を30に
  playerState.life = Math.min(playerState.life + amount, max);
  playerState.life = Math.max(playerState.life, 0); // 0未満にならないように

  updateLifeDisplay(); // ← 表示を更新する
	sendBattleUpdate()
}

// HP更新
function updateLifeDisplay() {
  console.log("updateLifeDisplay", playerState.life, enemyState.life);
  const playerHpEl = document.getElementById("player-hp");
  const enemyHpEl = document.getElementById("enemy-hp");

  if (playerHpEl) playerHpEl.textContent = playerState.life;
  if (enemyHpEl) enemyHpEl.textContent = enemyState.life;
}

// PP操作
function adjustPP(amount) {
	console.log("コストバーの更新 :",playerState.pp , playerState.maxpp)
  // 加算
  playerState.pp += amount;

  // 範囲制限（0 ～ maxpp）
  if (playerState.pp > playerState.maxpp) {
    playerState.pp = playerState.maxpp;
  } else if (playerState.pp < 0) {
    playerState.pp = 0;
  }

  // UI更新
  renderCostBar(playerState.pp, playerState.maxpp);
}

// コストバーの更新
function renderCostBar(current, max, isEnemy = false) {
	console.log("コストバーの更新 :",current , max)
  const barId = isEnemy ? "enemy-cost-bar" : "player-cost-bar";
  const iconClass = isEnemy ? "enemy-pp-icon" : "pp-icon";
  const filledIcon = isEnemy
    ? "/assets/images/cost/エネミーコスト.webp"
    : "/assets/images/cost/プレイヤーコスト.webp";
  const emptyIcon = "/assets/images/cost/ノーコスト.webp";

  const bar = document.getElementById(barId);
  if (!bar) return;

  bar.innerHTML = ""; // 初期化

  // コストアイコン表示
  for (let i = 0; i < max; i++) {
    const img = document.createElement("img");
    img.src = i < current ? filledIcon : emptyIcon;
    img.classList.add(iconClass);
    if (i >= current) img.classList.add("inactive");
    bar.appendChild(img);
  }

  // 数値表示要素の作成・追加
  const ppLabelId = isEnemy ? "enemy-pp-label" : "player-pp-label";
  let ppLabel = document.getElementById(ppLabelId);

  if (!ppLabel) {
    ppLabel = document.createElement("span");
    ppLabel.id = ppLabelId;
    ppLabel.className = "pp-text-label";
    ppLabel.style.marginLeft = "0.5em";
    ppLabel.style.fontSize = "0.9em";
    ppLabel.style.color = "#fff";
    bar.appendChild(ppLabel);
  }

  ppLabel.textContent = ` ${current} / ${max}`;
}


// デッキにinstanceIdを付ける
function expandDeckStructure(deckData, cardList) {
  const expanded = [];

  for (const [cardName, count] of Object.entries(deckData)) {
    const baseCard = cardList.find((c) => c["名前"] === cardName);
    if (!baseCard) {
      console.warn(`カード「${cardName}」が cardList に見つかりません`);
      continue;
    }

    for (let i = 0; i < count; i++) {
      const copy = { ...baseCard };
      copy.instanceId = nextInstanceId++; // 一意なIDを付与
      expanded.push(copy);
    }
  }

  console.log("デッキにinstanceIdを付ける", expanded);
  return expanded;
}


// シャッフル機能
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // swap
  }
  return deck;
}

// ドロー機能
async function drawCard() {
  if (playerState.drawPile.length === 0) {
    console.warn("デッキが空です");
    return;
  }

  const drawnCard = playerState.drawPile.shift(); // 先頭から1枚
  console.log("drawnCard:", drawnCard, playerState.playerHand);
  playerState.playerHand.push(drawnCard); // 手札に追加
  await updateCardZoneDisplay("手札"); // 表示更新
	await updateZoneCounts(playerState, "player-ui-bar");
}



//==================================================
// カード描写処理
//==================================================

// ゾーンキー どれを下のバーに表示するか選択
function updateCardZoneDisplay(zoneKey) {
  const zoneMap = {
    手札: { array: playerState.playerHand, container: "player-hand-icon", color: "#a88" },
    デッキ: { array: playerState.drawPile, container: "player-deck-card", color: "#ffec00" },
    捨て札: { array: playerState.graveyard, container: "player-discard-icon", color: "#ff5555" },
    EXデッキ: { array: playerState.exDeck, container: "player-ex-card", color: "#00c3ff" },
    トークン: { array: tokenCard, container: "", color: "#000000" }
  };

  const zone = zoneMap[zoneKey];
  if (zone) {
    renderCardZone(zone.array, zone.container, zoneKey);
  } else {
    console.warn("無効なゾーン:", zoneKey);
  }
  // 表示ゾーン名を更新＆ボーダー色変更
  const label = document.getElementById("player-zone-label");
  if (label) {
    label.textContent = zoneKey;
    label.style.borderBottom = `2px solid ${zone.color || "#ffec00"}`;
  }
}

// カード表示UI更新
function renderCardZone(zoneArray, containerId, locationLabel) {
  console.log("カード表示UI更新 :", zoneArray, locationLabel);
  // const container = document.getElementById(containerId);
  // 一旦表示場所固定
  const handContainer = document.getElementById("player-hand");
  const container = handContainer.querySelector("#hand-row");
  if (!container) return;
  container.innerHTML = "";

  zoneArray.forEach((card, index) => {
    const cardEl = createCardElement(card, {
      extraClass: "hand-card", // 共通のスタイル名（必要に応じて分岐可能）
      mode: "iconOnly",
    	index: index, // ← 順番を渡す
      onClick: (el, card) => {
        const wasSelected = el.classList.contains("selected");
        toggleCardSelection(el);
        if (!wasSelected) {
          openCardDetail(card, locationLabel); // ← 呼び出し元のゾーン名を渡す
        } else {
          closeCardDetail();
        }
      },
    });
		// ラッパー要素（番号とカードを一緒に囲む）
		const wrapper = document.createElement("div");
		wrapper.className = "card-wrapper";

		// 番号表示
		const numberLabel = document.createElement("div");
		numberLabel.className = "card-number-below";
		numberLabel.textContent = `${index + 1}`;

		// 組み立て
		wrapper.appendChild(cardEl);
		wrapper.appendChild(numberLabel);

		container.appendChild(wrapper);
	});
	renderField()
}

// フィールドUI表示
function renderField() {
  const fieldCards = playerState.field || [];

  // 1. 全スロットのキー一覧
  const allPositions = ["p0", "p1", "p2", "p3", "p4", "p5"];

  // 2. 今使われている位置を記録
  const usedPositions = new Set(fieldCards.map(card => card.position).filter(Boolean));

  // 3. 空いているスロットを順に取る関数
  const getNextAvailablePosition = () => {
    return allPositions.find(pos => !usedPositions.has(pos)) || null;
  };

  // 4. カードに position がなければ自動で付ける
  fieldCards.forEach(card => {
    if (!card.position) {
      const pos = getNextAvailablePosition();
      if (pos) {
        card.position = pos;
        usedPositions.add(pos);
      }
    }
  });

  // 5. 一旦すべてのスロットをクリア
  document.querySelectorAll('.player-field-slot').forEach(slot => {
    slot.innerHTML = '';
  });

  // 6. カードをそれぞれのスロットに表示
  fieldCards.forEach(card => {
    const slot = document.querySelector(`.player-field-slot[data-pos="${card.position}"]`);
    if (!slot) return;

    const cardEl = createCardElement(card, {
      extraClass: 'field-card',
      mode: 'iconOnly',
      onClick: (el, card) => {
        const wasSelected = el.classList.contains("selected");
        toggleCardSelection(el);
        if (!wasSelected) {
          openCardDetail(card, '場');
        } else {
          closeCardDetail();
        }
      }
    });

    slot.appendChild(cardEl);
  });
	updateZoneCounts(playerState, "player-ui-bar");
	sendBattleUpdate()
}
// 相手
function renderEnemyField() {
  const fieldCards = enemyState.field || [];
	console.log("renderEnemyField :", fieldCards)

  // 1. 全スロットのキー一覧
  const allPositions = ["p0", "p1", "p2", "p3", "p4", "p5"];

  // 2. 今使われている位置を記録
  const usedPositions = new Set(fieldCards.map(card => card.position).filter(Boolean));

  // 3. 空いているスロットを順に取る関数
  const getNextAvailablePosition = () => {
    return allPositions.find(pos => !usedPositions.has(pos)) || null;
  };

  // 4. カードに position がなければ自動で付ける
  fieldCards.forEach(card => {
    if (!card.position) {
      const pos = getNextAvailablePosition();
      if (pos) {
        card.position = pos;
        usedPositions.add(pos);
      }
    }
  });
  // 5. 一旦すべてのスロットをクリア（enemy only）
  document.querySelectorAll('.enemy-field-slot').forEach(slot => {
    slot.innerHTML = '';
  });

  // 6. カードをそれぞれのスロットに表示
  fieldCards.forEach(card => {
    const slot = document.querySelector(`.enemy-field-slot[data-pos="${card.position}"]`);
		console.log("renderEnemyField slot. ", slot)
    if (!slot) return;
		console.log("renderEnemyField cardEl. ")
    const cardEl = createCardElement(card, {
      extraClass: 'field-card',
      mode: 'iconOnly',
      onClick: (el, card) => {
				const wasSelected = el.classList.contains("selected");
				console.log('renderEnemyField opponentCardsFaceUp :', card, wasSelected)
				
				toggleCardSelection(el);
				if (!wasSelected) {
					console.log('renderEnemyField 敵の場 :', card)
					openCardDetail(card, '敵の場');
				} else {
					console.log('renderEnemyField closeCardDetail :')
					closeCardDetail();
				}
			}
    });

    slot.appendChild(cardEl);
  });
}


// カード選択処理
function toggleCardSelection(cardElement) {
  const alreadySelected = cardElement.classList.contains("selected");

  // すべての選択カードを解除（ゾーンを問わず）
  document.querySelectorAll(".card.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  if (!alreadySelected) {
    cardElement.classList.add("selected");
  }
}

//   closeControlPanel()

let opponentHand = []; // カードオブジェクト配列
let opponentCardsFaceUp = false; // 表か裏かのフラグ

// 敵の手札更新
function updateOpponentHandUI() {
  const opponentHandContainer = document.getElementById("opponent-hand");
  const opponentRow = opponentHandContainer.querySelector("#opponent-hand-row");
  opponentRow.innerHTML = "";

  opponentHand.forEach((card) => {
    let cardElement;

    if (opponentCardsFaceUp) {
      // 表向き → 通常カードと同じ描画
      cardElement = createCardElement(card, {
        extraClass: "opponent-card",
        onClick: (el, card) => {
          openCardDetail(card);
        },
      });
    } else {
      // 裏向きカード
      cardElement = document.createElement("div");
      cardElement.className = "card opponent-card-back";
    }

    opponentRow.appendChild(cardElement);
  });
}
// カード裏表切り替え
function toggleOpponentHandFace() {
  opponentCardsFaceUp = !opponentCardsFaceUp;
  updateOpponentHandUI();
}
//==================================================
// ターン管理
//==================================================







