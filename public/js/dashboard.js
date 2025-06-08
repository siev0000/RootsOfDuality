
let userData = JSON.parse(localStorage.getItem('userData') || '{}');
if (!userData.username || !Array.isArray(userData.decks)) {
  alert("ユーザーデータが正しく読み込めませんでした。ログイン画面に戻ります。");
  location.href = "index.html";
}
let username = userData.username;
const userId = userData.userId;
let deckList = userData.decks;
let volumeSettings = userData.settings.volume;

let selectedDeckId = userData.settings.selectedDeckId;
let selectedDeckName = null;;

let notifications = "" //お知らせ
let abilityDetails = [] // 能力一覧
let cardList = [] //カードリスト
let tokenCard = [] // トークンリスト
let battleHTMLLoaded = false; // 初回フラグ
let effectHTMLLoaded = false; // 初回フラグ



// 起動時の処理
document.addEventListener('DOMContentLoaded', async () => {
    console.log('ユーザー情報:', { username });
    console.log('音量設定:', volumeSettings);

    if (volumeSettings) {
        document.querySelector('#masterVolume').value = volumeSettings.master;
        document.querySelector('#bgmVolume').value = volumeSettings.bgm;
        document.querySelector('#sfxVolume').value = volumeSettings.sfx;
    }
    await fetchCardList();
    console.log('カードリスト 取得:', cardList);
    populateRaceAndClassOptions(cardList); // ← 種族・クラスのリスト化
    notifications = await fetchNotifications()
    console.log('お知らせ 取得:', notifications);
    abilityDetails = await loadAbilityDetails()

    console.log('abilityDetails 取得:', abilityDetails);

    // タブと内容を初期化
    generateNotificationTabs();
    await getUserDecks()
    showTab("home")
    initializeSelectedDeck() 
});

document.getElementById("open-filter-modal-button").onclick = () => {
    const filterHTML = document.getElementById("filter-controls").outerHTML;
    console.log("カードフィルタータブを呼び出す")
    openUniversalModal({
      type: "info",
      title: "カードフィルター",
      content: filterHTML,
      buttons: [
        {
          label: "適用",
          onClick: () => {
            // モーダル内のセレクト値をDOMに戻す
            const modal = document.querySelector(".universal-modal");
            const selects = modal.querySelectorAll("select");
            selects.forEach(select => {
              const original = document.getElementById(select.id);
              if (original) {
                original.value = select.value;
              }
            });
  
            applyFilters();
            closeUniversalModal();
          }
        },
        {
          label: "キャンセル",
          onClick: closeUniversalModal
        }
      ],
      vertical: true,
      backgroundOpacity: 0.92
    });
};
  
function initializeSelectedDeck() {
    selectedDeckId = localStorage.getItem('selectedDeckId') || null;
    selectedDeckName = localStorage.getItem('selectedDeckName') || null;
}

// 能力一覧を取得する関数（data/abilities.json）
async function loadAbilityDetails() {
  try {
    const response = await fetch('./data/abilities.json');
    const rawList = await response.json();

    if (!Array.isArray(rawList)) {
      console.error('abilities.json の形式が不正です（配列ではありません）');
      return false;
    }

    const grouped = {};
    let currentGroup = '未分類';

    for (const row of rawList) {
      const name = row["能力名"]?.trim();

      // 無効な名前を除外：null/空文字/'-'のみ（または複数）
      if (!name || /^-+$/.test(name)) continue;

      // === アタック系 === のような見出し行なら分類名とみなす
      const match = name.match(/^===\s*(.+?)\s*===$/);
      if (match) {
        currentGroup = match[1];
        if (!grouped[currentGroup]) grouped[currentGroup] = [];
        continue;
      }

      // 通常のデータ行は現在の分類に追加
      if (!grouped[currentGroup]) grouped[currentGroup] = [];
      grouped[currentGroup].push(row);
    }

    console.log('✅ abilityDetails 分類完了:', grouped);
    return grouped;


  } catch (error) {
    console.error('能力詳細取得エラー:', error);
    return false;
  }
}

// カードリストを取得する関数（data/cards.json）
async function fetchCardList() {
  try {
    const response = await fetch('./data/cards.json');
    const result = await response.json();

    if (!Array.isArray(result)) {
      console.error('cards.json の形式が不正です');
      alert('カードリストを取得できませんでした。');
      return { cards: [], tokenCard: [] };
    }

    // カードを分類
    tokenCard = result.filter(card => card?.分類1 === "トークン");

    console.log('カード:', result);
    console.log('トークンカード:', tokenCard);
    cardList = result
    return;

  } catch (error) {
    console.error('カードリスト取得エラー:', error);
    alert('カードリストの取得中にエラーが発生しました。');
    return { cards: [], tokenCard: [] };
  }
}


// お知らせを取得する関数（data/notifications.json）
async function fetchNotifications() {
  try {
    const response = await fetch('./data/notifications.json');
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('notifications.json の形式が不正です');
    }

    console.log('お知らせを取得しました:', data);
    return data;

  } catch (error) {
    console.error('お知らせ取得エラー:', error);
    return [];
  }
}

// ログアウト
function logout() {
    window.location.href = '/index.html?';
}
// 音量設定フォームの送信処理
document.addEventListener('DOMContentLoaded', () => {
    const volumeForm = document.getElementById('volumeSettingsForm');
    if (volumeForm) {
        volumeForm.addEventListener('submit', (event) => {
            event.preventDefault(); // 再読み込みを防ぐ
            saveVolumeSettings();  // 音量設定の保存処理を呼び出し
        });
    } else {
        console.error('volumeSettingsForm が見つかりません。HTML構造を確認してください。');
    }
});
// 音量設定保存処理
function saveVolumeSettings() {
    const masterVolume = document.querySelector('#masterVolume').value;
    const bgmVolume = document.querySelector('#bgmVolume').value;
    const sfxVolume = document.querySelector('#sfxVolume').value;
    volumeSettings.master = masterVolume;
    volumeSettings.bgm = bgmVolume;
    volumeSettings.sfx = sfxVolume;
}

async function showTab(tabId) {
    console.log("Switching to tab:", tabId); // デバッグ用ログ

    // タブコンテンツを非表示
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // タブボタンのアクティブ状態を解除
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // 指定されたタブをアクティブ化
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    } else {
        console.error(`Tab with ID "${tabId}" not found.`);
    }

    // 対応するボタンをアクティブ化
    const targetButton = document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    } else {
        console.error(`Button for Tab ID "${tabId}" not found.`);
    }
    toggleNotificationContent(false)
    loadBattleScreen() // 使ってない時は閉じる
    // タブごとのカスタム処理
    switch (tabId) {
        case 'home':
            console.log('ホームタブを表示しています...');
            // ホームタブ用の処理をここに追加
            displayNotificationsByKey("お知らせ");
            break;

        case 'editDeck':
            console.log('デッキ編集タブを表示しています...');
            await getUserDecks(); // デッキ一覧を読み込む関数を呼び出し
            await displayDecks()
            break;

        case 'battle':
            console.log('バトルタブを表示しています...');
            // バトルタブ用の処理をここに追加
            break;

        case 'openSettings':
            console.log('設定タブを表示しています...');
            // 設定タブ用の処理をここに追加
            break;

        case 'effects':
            console.log('エフェクトタブを表示しています...');
            // 設定タブ用の処理をここに追加
            const playButton = document.getElementById("play-button");
            if (playButton) {
                playButton.onclick = playSelected;
            } else {
                console.warn("play-button が見つかりません");
            }
            break;

        default:
            console.log(`未定義のタブ: ${tabId}`);
    }
}

function showSection(sectionId) {
    // すべてのセクションを取得して非アクティブ化
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // 指定されたセクションをアクティブ化
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// battle.htmlを読み込む
async function loadBattleScreen() {
    try {
        const battleContainer = document.getElementById("battle");

        // 初回のみfetchして中身を埋め込む
        if (!battleHTMLLoaded) {
            const response = await fetch("battle.html");
            const html = await response.text();
            battleContainer.innerHTML = html;
            battleHTMLLoaded = true;

            // UIイベントなど初期設定
            bindMatchingEvents();
        }
        // デッキを名を表示するやつ
        updateSelectedDeckDisplay();
        // タブの表示切替に応じて見せる・隠す
        if (battleContainer.classList.contains('active')) {
            battleContainer.style.display = 'block';
        } else {
            battleContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("バトル画面の読み込みに失敗しました:", error);
    }
}


 // タブを生成する関数
function generateNotificationTabs() {
  const tabContainer = document.getElementById('notification-controls');
  console.log("タブコンテナ取得:", tabContainer);

  if (!tabContainer) {
    console.error('エラー: #notification-controls が見つかりません。HTML構造を確認してください。');
    return;
  }

  if (!Array.isArray(notifications)) {
    console.error("エラー: notifications が配列ではありません。値:", notifications);
    return;
  }

  if (notifications.length === 0) {
    console.warn("通知データが空です。タブは生成されません。");
    return;
  }

  const keys = Object.keys(notifications[0]);
  keys.push("能力一覧"); // ← abilityDetails用のタブを追加
  keys.push("ルール"); // ← abilityDetails用のタブを追加
  console.log("通知データのキー一覧:", keys);

  tabContainer.innerHTML = ''; // 初期化

  keys.forEach(key => {
    const button = document.createElement('button');
    button.textContent = key;
    button.className = 'notification-tab-button'; // 任意のCSSクラス
    button.onclick = () => {
      console.log(`「${key}」タブがクリックされました`);
      displayNotificationsByKey(key);
    };
    tabContainer.appendChild(button);
    console.log(`「${key}」タブを追加しました`);
  });

  // 最初のタブを自動表示
  if (keys.length > 0) {
    console.log("最初のタブを自動表示:", keys[0]);
    displayNotificationsByKey(keys[0]);
  }
}

function displayNotificationsByKey(key) {
  const container = document.getElementById('notification-content');
  if (!container) return;

  console.log(`表示対象のキー: ${key}`);
  container.innerHTML = `<h2>${key}</h2>`;
  const ul = document.createElement('ul');
  if (key === "能力一覧") {
    displayAbilityDetails(); // 別関数で表示
    return;
  }
  if (key === "ルール") {
    displayRules(); // 別関数で表示
    return;
  }
  let hasContent = false;

  notifications.forEach((entry, index) => {
    const content = entry[key];
    console.log(`通知[${index}] の ${key}:`, content);

    if (content && content.trim() !== "") {
      const li = document.createElement('li');
      li.textContent = content;
      ul.appendChild(li);
      hasContent = true;
    }
  });

  if (hasContent) {
    container.appendChild(ul);
  } else {
    container.innerHTML += `<p>「${key}」に該当するデータがありません。</p>`;
  }
}

async function displayAbilityDetails() {
  const container = document.getElementById('notification-content');
  if (!container) return;

  container.innerHTML = `<h2>能力一覧</h2>`;

  if (!abilityDetails || typeof abilityDetails !== 'object') {
    container.innerHTML += "<p>能力データがありません。</p>";
    return;
  }

  console.log("能力一覧表示 :", abilityDetails);

  // 分類ごとに表示
  for (const [groupName, entries] of Object.entries(abilityDetails)) {
    const groupHeader = document.createElement('h3');
    groupHeader.textContent = groupName;
    container.appendChild(groupHeader);

    const list = document.createElement('ul');
    list.className = 'ability-list';

    entries.forEach(entry => {
      const name = entry["能力名"]?.trim();
      const effect = entry["効果"]?.trim();

      if (!name || name.startsWith("===")) return; // 見出し行は除外済み

      const li = document.createElement('li');
      li.textContent = `${name}：${effect || ""}`;
      list.appendChild(li);
    });

    container.appendChild(list);
  }
}

// ルール
async function displayRules() {
  const container = document.getElementById('notification-content');
  container.innerHTML = `<h2>ルール</h2><p>読み込み中...</p>`;

  try {
    const res = await fetch('/data/カードゲーム_基本ルール.txt');
    let text = await res.text();

    // 🌿 を画像に置換
    text = text.replace(/🌿/g, `<img src="/assets/images/cost/プレイヤーコスト.webp" alt="🌿" class="icon-inline">`);

    // 【～】で囲まれた部分を色付きに変換（HTMLタグで囲む）
    text = text.replace(/【(.*?)】/g, `<span class="highlight-heading">【$1】</span>`);

    container.innerHTML = `<pre class="rules-text">${text}</pre>`;
  } catch (err) {
    container.innerHTML = '<p>ルールの読み込みに失敗しました。</p>';
    console.error('ルール読み込み失敗:', err);
  }
}



function toggleNotificationContent(shouldShow) {
    const contentContainer = document.getElementById('notification-content');
    if (!contentContainer) {
        console.error('エラー: #notification-content が見つかりません。');
        return;
    }

    if (shouldShow) {
        contentContainer.classList.add('active'); // 表示
    } else {
        contentContainer.classList.remove('active'); // 非表示
    }
}

// データ保存処理
function exportUserDataToFile() {
  if (!userData) {
    alert("保存するデータが見つかりません。");
    return;
  }

  // 変更された値を反映
  userData.decks = deckList;
  userData.settings.volume = volumeSettings;
  userData.settings.selectedDeckId = selectedDeckId;

  // ファイル名生成（安全な文字列に）
  const safeUsername = (userData.username || "user").replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `カードバトル_${safeUsername}.json`;

  // ファイルとしてダウンロード
  const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



// デッキ呼び出し============

// デッキ読み込み
function getUserDecks() {
  return deckList;
}

// デッキ選択画面
function displayDecks() {
    const deckContainer = document.getElementById('deck-container');
    if (!deckContainer) return;

    const selectedDeckId = localStorage.getItem('selectedDeckId');
    deckContainer.innerHTML = '';

    // 新規作成カード
    const createDeckCard = document.createElement('div');
    createDeckCard.className = 'deck-create-card';
    createDeckCard.innerHTML = `
        <h3>新規デッキ作成</h3>
        <button onclick="createNewDeck()">作成</button>
    `;
    deckContainer.appendChild(createDeckCard);

    if (!deckList || deckList.length === 0) {
        deckContainer.innerHTML += `<p>デッキがありません。</p>`;
        return;
    }

deckList.forEach(deck => {
    if (!deck.deck) {
        console.warn("デッキ情報が無効なためスキップ:", deck);
        return;
    }

    const isSelected = (deck._id === selectedDeckId);

    const deckCard = document.createElement('div');
    deckCard.className = 'deck-card';
    deckCard.style.position = 'relative';
    if (isSelected) deckCard.classList.add('selected-deck');

    // 最大コストのキャラカードを取得
    let maxCard = null;
    let maxCost = -1;

    // 種族・分類・EX カウント用
    const typeCounts = { キャラ: 0, 施設: 0, その他: 0 };
    const raceCounts = {};
    let exCount = 0;

    for (const [name, count] of Object.entries(deck.deck)) {
        const cardData = cardList.find(c => c.名前 === name);
        if (!cardData) continue;

        // 最大コストキャラ
        if (cardData.分類1 === 'キャラ' && cardData.コスト > maxCost) {
            maxCard = cardData;
            maxCost = cardData.コスト;
        }

        // 分類カウント
        const type = cardData.分類1;
        if (type === 'キャラ' || type === '施設') {
            typeCounts[type] += count;
        } else {
            typeCounts.その他 += count;
        }

        // EXカウント
        if (cardData.レアリティ === 'EX') {
            exCount += count;
        }

        // 種族カウント（種族1のみ）
        if (cardData.種族1) {
            raceCounts[cardData.種族1] = (raceCounts[cardData.種族1] || 0) + count;
        }
    }

    // 一番多い種族を取得
    const mostUsedRace = Object.entries(raceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'なし';

    // 背景設定（略）
    if (maxCard && maxCard.画像) {
        deckCard.style.backgroundImage = `url('/assets/images/illust/${encodeURIComponent(maxCard.画像)}.webp')`;
        deckCard.style.backgroundSize = 'cover';
        deckCard.style.backgroundPosition = 'center 10%';
        deckCard.style.backgroundRepeat = 'no-repeat';
        deckCard.style.backgroundBlendMode = 'multiply';
        deckCard.style.backgroundColor = 'rgba(0,0,0,0.5)';
        deckCard.style.color = '#fff';
        deckCard.style.padding = '1em';
        deckCard.style.borderRadius = '12px';
    }

    // 表示内容 <p>デッキID: ${deck._id}</p>
    const totalCards = Object.values(deck.deck).reduce((a, b) => a + b, 0);
    deckCard.innerHTML = `
        <div class="deck-checkmark" onclick="setSelectedDeck('${deck._id}')">
            ${isSelected ? '✔ 使用中' : '□ 使用'}
        </div>
        <h3>${deck.name}</h3>
        <p>主要種族: ${mostUsedRace}</p>
        <p>デッキ枚数: ${totalCards-exCount} ${exCount > 0 ? `EX: ${exCount}枚` : ''}</p>
        <p>構成: キャラ${typeCounts.キャラ} / 施設${typeCounts.施設} / その他${typeCounts.その他}</p>
        <button onclick="getDeckById('${deck._id}')">デッキを見る</button>
    `;

    deckContainer.appendChild(deckCard);
});

}


// 使用するデッキをセット
function setSelectedDeck(deckId) {
    const deck = deckList.find(d => d._id === deckId);
    if (deck) {
        selectedDeckId = deckId;
        selectedDeckName = deck.name;

        localStorage.setItem('selectedDeckId', selectedDeckId);
        localStorage.setItem('selectedDeckName', selectedDeckName);

        console.log(`デッキ選択: ${selectedDeckName}（ID: ${selectedDeckId}）`);
    } else {
        console.warn(`選択されたデッキIDが見つかりません: ${deckId}`);
    }
    updateSelectedDeckDisplay();
    displayDecks();
}

// デッキにカードを追加または削除する関数
function adjustCardCount(cardId, action) {
    if (!deck[cardId]) {
        deck[cardId] = 0;
    }

    // 名前からカードデータを検索
    const cardData = cardList.find(c => c.名前 === cardId);
    const rarity = cardData?.レアリティ || "B";
    const cardType = cardData?.分類1 || "マジック";

    console.log("rarity :", rarity, cardId, )

    // 枚数集計
    const totalCards = Object.values(deck).reduce((sum, val) => sum + val, 0);
    const exCardCount = Object.entries(deck)
        .map(([name, count]) => {
            const c = cardList.find(card => card.名前 === name);
            return (c?.レアリティ === "EX") ? count : 0;
        })
        .reduce((a, b) => a + b, 0);
    const normalCardCount = totalCards - exCardCount;

    if (action === 'add') {
        if (cardType === "トークン") {
            alert("トークンはデッキにいれることは出来ません");
            return;
        }

        if (deck[cardId] >= 3) {
            alert('このカードは既に最大枚数です！');
            return;
        }

        if (rarity === "EX") {
            if (exCardCount >= 3) {
                alert("EXカードは最大3枚までです！");
                return;
            }
        } else {
            if (normalCardCount >= 40) {
                alert("通常カードは最大40枚までです！");
                return;
            }
        }

        if (totalCards >= 43) {
            alert("デッキの合計は最大43枚までです！");
            return;
        }



        deck[cardId]++;
    } else if (action === 'remove') {
        if (deck[cardId] > 0) {
            deck[cardId]--;
        }
        if (deck[cardId] === 0) {
            delete deck[cardId];
        }
    }

    updateDeckHeader();
    // renderCardPool()
    restoreDeckButtonStates();
    calculateCostBreakdown(deck);
}



//カード枚数調整
function addCardToDeck(cardName) {
    adjustCardCount(cardName, 'add');
}
function removeCardFromDeck(cardName) {
    adjustCardCount(cardName, 'remove');
}

// カードUIの作成モード切替ができる
function createCardElement(card, options = {}) {
    const {
        onClick = null,
        extraClass = '',
        mode = 'full'
    } = options;


    const cardElement = document.createElement('div');
    cardElement.className = `card ${extraClass}`;

    // // 番号割り振り ==============================================
    // // オプション番号があれば番号を上に追加
    // if (options.index != null) {
    //   const numberLabel = document.createElement("div");
    //   numberLabel.className = "card-number-label";
    //   numberLabel.textContent = `${options.index + 1}`; // 1始まり
    //   cardElement.appendChild(numberLabel);
    // }
    // //============================================================

    // レイヤー構築
    const rarityLayer = document.createElement('div');
    rarityLayer.className = 'card-rarity-layer';
    let type;
    switch (card.分類1) {
      case "キャラ":
        type = "キャラ";
        break;
      case "施設":
        type = "施設";
        break;
      case "トークン":
        type = "トークン";
        break;
      default:
        type = "マジック";
        break;
    }

    // 背景画像の設定
    rarityLayer.style.backgroundImage = `url('/assets/images/card/${type}.webp')`;
    cardElement.appendChild(rarityLayer);

    // === 属性（属性1）レイヤー：キャラのときのみ ===
    if (type === "キャラ") {
      const attributeLayer = document.createElement('div');
      attributeLayer.className = 'card-attribute-layer';

      const attr = card.属性 || '無'; // 属性がなければ「無」
      attributeLayer.style.backgroundImage = `url('/assets/images/card/${encodeURIComponent(attr)}.webp')`;

      cardElement.appendChild(attributeLayer);
    }


    const backgroundLayer = document.createElement('div');
    backgroundLayer.className = 'card-illustration-layer';
    
    const imageUrl = `/assets/images/illust/${encodeURIComponent(card.画像)}.webp`;
    const img = new Image();
    img.onload = () => {
        backgroundLayer.style.backgroundImage = `url('${imageUrl}')`;
    };
    img.onerror = () => {
        backgroundLayer.style.backgroundImage = `url('/assets/images/illust/default.webp')`;
    };
    img.src = imageUrl;
    
    cardElement.appendChild(backgroundLayer);

    // 名前とアイコン
    const iconNameContainer = document.createElement('div');
    iconNameContainer.className = 'icon-name-container';

    const exIcon = card.レアリティ === "EX"
    ? `<div class="race-icon icon-mask" style="background-image: url('/assets/images/card/EXアイコン2.webp');"></div>`
    : '';
    
    iconNameContainer.innerHTML = `
        <p class="character-name">${card.名前}</p>
        <div class="icon-container">
            ${exIcon}
            ${card.種族1 ? `<div class="race-icon icon-mask" style="background-image: url('/assets/images/role/${card.種族1}.webp');"></div>` : ''}
            ${card.種族2 ? `<div class="race-icon icon-mask" style="background-image: url('/assets/images/role/${card.種族2}.webp');"></div>` : ''}
            ${card.職業1 ? `<div class="class-icon icon-mask" style="background-image: url('/assets/images/role/${card.職業1}.webp');"></div>` : ''}
            ${card.職業2 ? `<div class="class-icon icon-mask" style="background-image: url('/assets/images/role/${card.職業2}.webp');"></div>` : ''}
        </div>
    `;

    
    // フォントサイズを状況によって調整
    const nameElement = iconNameContainer.querySelector('.character-name');
    if (nameElement) {
      const nameLength = card.名前 ? card.名前.length : 0;

      let fontPercent = 70; // 初期値

      if (nameLength > 5) {
          const overLength = nameLength - 5;
          const reduceStep = Math.floor(overLength / 3) * 10;
          fontPercent = Math.max(50, fontPercent - reduceStep); // 最小30%
      }
      nameElement.style.fontSize = `${fontPercent}%`;
    }
    cardElement.appendChild(iconNameContainer);

    // ステータス
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    let costIcon = 'cost/プレイヤーコスト.webp'; // デフォルト 
    // let costIcon = 'card/コスト.webp'; // デフォルト 'cost/プレイヤーコスト.webp'
    // if (card.分類1 === 'キャラ') {
    //   costIcon = 'card/キャラ.webp';
    // } else if (card.分類1 === '施設') {
    //   costIcon = 'card/施設.webp';
    // } else if (card.分類1 === 'その他') {
    //   costIcon = 'card/コスト.webp';
    // }

    statsContainer.innerHTML = `
      ${card.コスト ? `<span class="card-cost" style="background-image: url('/assets/images/${costIcon}');">${card.コスト}</span>` : ''}
      ${card.HP ? `<span class="card-hp">${card.HP}</span>` : ''}
      ${card.ATK ? `<span class="card-atk">${card.ATK}</span>` : ''}
    `;


    cardElement.appendChild(statsContainer);

    // 能力説明（常に構築）
    const abilityContainer = document.createElement('div');
    abilityContainer.className = 'ability-container';
    abilityContainer.style.backgroundColor = 'transparent'; // 初期は透明

    const abilityText = document.createElement('p');
    abilityText.className = 'ability-description';
    // abilityText.textContent = (mode === 'full') ? (card.能力説明 || '') : '';
    abilityContainer.appendChild(abilityText);
    cardElement.appendChild(abilityContainer);

    // 編集可能なカード（プール・デッキ）
    if (extraClass.includes('deck-card') || extraClass.includes('pool-card')) {
      cardElement.addEventListener('click', () => {
          // 他のカードの選択状態を解除
          const allSelected = document.querySelectorAll('.deck-card.selected, .pool-card.selected');
          allSelected.forEach(el => {
              el.classList.remove('selected');
              el.querySelectorAll('.card-add, .card-remove').forEach(btn => btn.remove());
          });

          // このカードだけを選択状態にする
          cardElement.classList.add('selected');
          openDeckDetail(card);

          if (options.onAdd) {
              const addButton = document.createElement('button');
              addButton.className = 'card-add';
              addButton.textContent = '+';
              addButton.onclick = (e) => {
                  e.stopPropagation();
                  options.onAdd(card);
              };
              cardElement.appendChild(addButton);
          }

          if (options.onRemove) {
              const removeButton = document.createElement('button');
              removeButton.className = 'card-remove';
              removeButton.textContent = '−';
              removeButton.onclick = (e) => {
                  e.stopPropagation();
                  options.onRemove(card);
              };
              cardElement.appendChild(removeButton);
          }
      });
    }


    // 通常クリック処理
    if (onClick && !extraClass.includes('deck-card') && !extraClass.includes('pool-card')) {
        cardElement.addEventListener('click', () => onClick(cardElement, card));
    }

    return cardElement;
}



