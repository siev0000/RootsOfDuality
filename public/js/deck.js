// デッキの状態を管理するオブジェクト
let deck = {}; // 例: { "1": 2, "2": 1 } (カードID: 枚数)
let currentDeckId = null; // デッキID
let currentDeckName = null; //デッキ名



// デッキ情報を表示する関数
function updateDeckDisplay() {
    console.log('現在のデッキ:', deck);

    // 合計カード数やコストの計算
    const totalCards = Object.values(deck).reduce((sum, count) => sum + count, 0);
    console.log(`デッキ内の合計カード数: ${totalCards}`);
}


// デッキ編集を開く
async function createNewDeck(existingDeck = null) {
    const modal = document.getElementById('deck-modal');
    modal.style.display = 'block'; // モーダルを表示

    if (existingDeck) {
        console.log('既存デッキをロード:', existingDeck);

        // deckオブジェクトを初期化して、ロードする
        deck = { ...existingDeck.deck };  // ← 保存されていた「デッキのカード構成」をロード

        // 現在のデッキ名とIDを保存
        currentDeckId = existingDeck._id;
        currentDeckName = existingDeck.name;
    } else {
        // 新規作成モード
        deck = {};
        currentDeckId = null;
        currentDeckName = null;
    }

    renderCardPool();
    updateDeckHeader(); // ← これで今のデッキ内容を再描画
    // コスト枚数を計算
    calculateCostBreakdown(deck);
    
}


// モーダルを閉じる
function closeDeckModal() {
    showTab('editDeck'); // デッキ編集画面に戻る
    const modal = document.getElementById('deck-modal');
    modal.style.display = 'none';
}


// デッキの保存処理
async function showDeckSaveModal() {
    // カードリストを取得
    if (!cardList || cardList.length === 0) {
        alert("カードリストが取得できていません。");
        return;
    }

    let selectedCards = [];

    // デッキに含まれるカードを cardList から取得
    Object.keys(deck).forEach(cardName => {
        console.log(" デッキに含まれるカードを :", cardName)
        const foundCard = cardList.find(card => card.名前.trim() === cardName.trim());
        console.log(" デッキに含まれるカードを :", foundCard)
        if (foundCard) {
            selectedCards.push({
                id: foundCard.id,
                name: foundCard.名前,
                cost: Number(foundCard.コスト),
                atk: Number(foundCard.ATK),
                hp: Number(foundCard.HP),
                type: foundCard.分類1, // カードの分類（キャラ・マジック・施設）
                count: deck[cardName] // デッキ内の枚数
            });
        } else {
            console.warn(`カード「${cardName}」が見つかりませんでした。`);
        }
    });

    if (selectedCards.length === 0) {
        alert("デッキが空です。カードを追加してください。");
        return;
    }

    // デッキの合計コスト・攻撃力・HPを計算
    const cardCount = selectedCards.reduce((sum, card) => sum + card.count, 0);

    // カードタイプごとの枚数をカウント
    const cardTypeCounts = {
        キャラ: 0,
        施設: 0,
        スキル: 0,
        マジック: 0,
        イベント: 0
    };

    selectedCards.forEach(card => {
        if (cardTypeCounts.hasOwnProperty(card.type)) {
            cardTypeCounts[card.type] += card.count;
        }
    });
    console.log(" デッキの中身 :", selectedCards)
    // デッキの枚数が 40 枚未満の場合の警告メッセージ
    const warningMessage = cardCount < 40 
        ? `<p style="color: red; font-weight: bold;">⚠ デッキが完成していません！あと ${40 - cardCount} 枚必要です。</p>` 
        : '';

    const contentHTML = `
        ${warningMessage}
        <p><strong>カード枚数合計: ${cardCount}枚</strong></p>
        <ul>
            <li>キャラ: <strong>${cardTypeCounts.キャラ}</strong> 枚</li>
            <li>施設: <strong>${cardTypeCounts.施設}</strong> 枚</li>
            <li>スキル: <strong>${cardTypeCounts.スキル}</strong> 枚</li>
            <li>マジック: <strong>${cardTypeCounts.マジック}</strong> 枚</li>
            <li>イベント: <strong>${cardTypeCounts.イベント}</strong> 枚</li>
        </ul>
    `;

    // モーダル表示
    openUniversalModal({
        type: "info",
        title: "デッキの情報",
        content: contentHTML,
        buttons: [
            { label: "保存する", onClick: showDeckNameInputModal },
            { label: "戻る", onClick: confirmReturnToEdit },
            { label: "キャンセル", onClick: closeUniversalModal }
        ]
    });
}

// 「戻る」ボタンを押したときの確認処理
function confirmReturnToEdit() {
    openUniversalModal({
        type: "warning",
        title: "確認",
        content: `
            <p>変更内容は保存されません。</p>
            <p>デッキ編集画面に戻りますか？</p>
        `,
        buttons: [
            {
                label: "はい",
                onClick: () => {
                    closeDeckModal(); // モーダルを閉じる
                    closeUniversalModal()
                }
            },
            {
                label: "いいえ",
                onClick: closeUniversalModal
            }
        ]
    });
}

// コスト計算ver2
function calculateCostBreakdown(deck, cardData=cardList, targetId="deck-cost-summary") {
    const costMap = {}; // {1: 3枚, 2: 4枚, ...}
    let total = 0;
  
    for (const [name, count] of Object.entries(deck)) {
      const card = cardList.find(c => c.名前 === name);
      if (card && card.コスト != null) {
        const cost = Number(card.コスト);
        costMap[cost] = (costMap[cost] || 0) + count;
        total += count;
      }
    }
  
    // const summary = Object.keys(costMap)
    //   .sort((a, b) => Number(a) - Number(b))
    //   .map(cost => `コスト${cost}:${costMap[cost]}枚`)
    //   .join(', ');
  
    const displayText = `合計:${total}枚`; // `${summary} / 合計:${total}枚`;
  
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) target.textContent = displayText;
    }
    console.log("デッキコスト計算:", displayText)
    renderCostBarFromMap( costMap ) ;
}
// グラフ化
function renderCostBarFromMap(costMap, targetId="deck-cost-bar") {
    const container = document.getElementById(targetId);
    container.innerHTML = '';
  
    Object.keys(costMap)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(cost => {
        const count = costMap[cost];
        const div = document.createElement('div');
        div.className = 'cost-bar-segment';
        // ${'▮'.repeat(count)} 
        div.innerHTML = `<strong>${cost}:</strong> <span class="count-text">${count}枚</span>`;
        container.appendChild(div);
    });
}
  
// デッキ名を入力
function showDeckNameInputModal() {
    // if (currentDeckName) {
    //     // 既存デッキ編集中ならそのまま保存！
    //     saveDeck(currentDeckName);
    //     return;
    // }
    openUniversalModal({
      type: "info",
      title: "デッキ名を入力",
      content: `
        <label for="deckName">デッキ名:</label>
        <input type="text" id="deckName" value="${currentDeckName || ''}" placeholder="デッキ名を入力" style="width: 90%; padding: 5px;">
      `,
        buttons: [
            {
                label: "保存",
                onClick: () => {
                    const deckName = document.getElementById('deckName').value.trim();
                    if (!deckName) {
                        alert("デッキ名を入力してください。");
                        return;
                    }
                    saveDeck(deckName); // デッキを保存する処理へ
                    
                }
            },
            {
                label: "キャンセル",
                onClick: closeUniversalModal
            }
        ]
    });
}

// デッキ保存
function saveDeck(deckName) {
  const now = new Date().toISOString();

  // 編集中のデッキがあるかどうか
  const deckId = currentDeckId || generateUUID();  // 新規なら新IDを生成

  const newDeck = {
    _id: deckId,
    id: deckId,
    name: deckName,
    deck: deck,  // ← 現在の構築済みデッキ
    createdAt: deck.createdAt || now,
    updatedAt: now,
    isPublic: deck.currentDeckIsPublic || false
  };

  // 上書き or 新規追加
  const index = deckList.findIndex(d => d._id === deckId);
  if (index !== -1) {
    deckList[index] = newDeck;
  } else {
    deckList.push(newDeck);
  }

  // 保存して反映
  const userData = JSON.parse(localStorage.getItem('userData'));
  userData.decks = deckList;

  // ✅ 選択中のデッキだった場合、明示的に更新
  if (deckId === userData.settings.selectedDeckId) {
    userData.settings.selectedDeckId = deckId;
    userData.settings.selectedDeckName = deckName;
  }

  localStorage.setItem('userData', JSON.stringify(userData));

  
  alert("デッキを保存しました！");
  closeUniversalModal();
  closeDeckModal();
}
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 文字数からフォントサイズ調整
function calculateFontSize(name) {
    const baseFontSize = 2.0; // 基本フォントサイズ（rem）
    const minFontSize = 0.2; // 最小フォントサイズ（rem）
    const length = name.length; // 文字数
    return `${Math.min(Math.max(minFontSize, baseFontSize / length), 0.8)}em`;
}

//カード情報パネルを出す
function openDeckDetail(card) {
    document.getElementById("deck-detail-name").textContent = `名前: ${card.名前} / 職業: ${card.職業1 || ''} / 種族: ${card.種族1 || ''}`;
    document.getElementById("deck-detail-ability").textContent = `効果: ${card.能力説明 || 'なし'}`;
}

// デッキIDを指定して取得
function getDeckById(deckId) {
  console.log("deckId :", deckId , "\n deckList :", deckList)
  const deck = deckList.find(deck => deck.id === deckId || deck._id === deckId);
  if (!deck) {
    alert("デッキが見つかりません。");
    return;
  }

  createNewDeck(deck);  // ← これが「デッキを開く」処理
}

// デッキ削除
function deleteDeck(deckId) {
  deckList = deckList.filter(deck => deck.id !== deckId);
  userData.decks = deckList;
  localStorage.setItem('userData', JSON.stringify(userData));
}

// 表示用などでユーザー名を取得したい場合に使う
function getUsername() {
  return userData.username;
}


// 現在選択されているカードを追跡
let selectedCard = null;

// カード選択状態を切り替える関数
function toggleCardButtons(cardElement) {
    // 他のカードのボタンを非表示
    document.querySelectorAll('.card').forEach(otherCard => {
        if (otherCard !== cardElement) {
            const plusButton = otherCard.querySelector('.plus');
            const minusButton = otherCard.querySelector('.minus');
            
            // ボタンが存在する場合のみ非表示
            if (plusButton) plusButton.style.display = 'none';
            if (minusButton) minusButton.style.display = 'none';
        }
    });

    // 現在のカードのボタンをトグル表示
    const plusButton = cardElement.querySelector('.plus');
    const minusButton = cardElement.querySelector('.minus');

    if (plusButton && minusButton) {
        if (plusButton.style.display === 'none') {
            plusButton.style.display = 'flex';
            minusButton.style.display = 'flex';
        } else {
            plusButton.style.display = 'none';
            minusButton.style.display = 'none';
        }
    } else {
        console.warn('プラスボタンまたはマイナスボタンが見つかりませんでした:', cardElement);
    }
}

// タブ切り替え
function showDeckTab(target) {
    // 表示切り替え
    document.getElementById('deck-section').style.display = (target === 'deck') ? 'block' : 'none';
    document.getElementById('card-pool-section').style.display = (target === 'pool') ? 'block' : 'none';
    // document.getElementById('pool-category-tabs').style.display = (target === 'pool') ? 'flex' : 'none';
  
    // アクティブクラスの切り替え
    document.querySelectorAll('#deck-tabs .tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    if (target === 'pool') {
      document.querySelector('#deck-tabs .tab-button:nth-child(1)').classList.add('active');
    } else if (target === 'deck') {
      document.querySelector('#deck-tabs .tab-button:nth-child(2)').classList.add('active');
    }
  
    // ロジック処理
    if (target === 'deck') {
      updateDeckHeader();
      console.log("デッキ表示");
    } else {
      filterCardPool(currentCategory);
      console.log("カードプール表示");
    }
  }
  
  
  let currentCategory = 'all'; // 現在の分類フィルタ

// フィルター
function filterCardPool(category) {
    currentCategory = category;
    applyFilters(); // ← コストと組み合わせるため1か所に集約
}
// 追加フィルター
function applyFilters() {
    const selectedCost = document.getElementById('filter-cost').value;
    const selectedRace = document.getElementById('filter-race').value;
    const selectedClass = document.getElementById('filter-class').value;
    const selectedRarity= document.getElementById('filter-rarity').value;
  
    let filtered = cardList;
  
    // 分類フィルタ
    if (currentCategory !== 'all') {
      filtered = filtered.filter(card => card.分類1 === currentCategory);
    }
  
    // コストフィルタ
    if (selectedCost !== '') {
      filtered = filtered.filter(card => String(card.コスト) === selectedCost);
    }
  
    // 種族フィルタ
    if (selectedRace !== '') {
      filtered = filtered.filter(card => card.種族1 === selectedRace);
    }
  
    // クラスフィルタ
    if (selectedClass !== '') {
      filtered = filtered.filter(card => card.職業1 === selectedClass);
    }
  
    // レアリティフィルタ
    if (selectedRarity !== '') {
    filtered = filtered.filter(card => card.レアリティ === selectedRarity);
    }

    // 表示更新
    const container = document.getElementById('card-pool-list');
    container.innerHTML = '';
    filtered.forEach(card => {
      const cardElement = createCardElement(card, {
        extraClass: 'pool-card simple-mode',
        mode: 'simple',
        onAdd: (card) => adjustCardCount(card.名前, 'add'),
        onRemove: (card) => adjustCardCount(card.名前, 'remove')
      });
      container.appendChild(cardElement);
    });
}
  
// 種族クラスのフィルター
function populateRaceAndClassOptions(cardList) {
    const raceSet = new Set();
    const classSet = new Set();
  
    cardList.forEach(card => {
      if (card.種族1) raceSet.add(card.種族1.trim());
      if (card.職業1) classSet.add(card.職業1.trim());
    });
  
    const raceSelect = document.getElementById("filter-race");
    const classSelect = document.getElementById("filter-class");
  
    raceSelect.innerHTML = '<option value="">すべて</option>';
    classSelect.innerHTML = '<option value="">すべて</option>';
  
    [...raceSet].sort().forEach(race => {
      const option = document.createElement("option");
      option.value = race;
      option.textContent = race;
      raceSelect.appendChild(option);
    });
  
    [...classSet].sort().forEach(cls => {
      const option = document.createElement("option");
      option.value = cls;
      option.textContent = cls;
      classSelect.appendChild(option);
    });
}
// +-ボタンを再表示する
function restoreDeckButtonStates() {
    const buttons = document.querySelectorAll('#deck-list .deck-card button');
    buttons.forEach(button => {
      const cardName = button.getAttribute('data-card-name');
      const count = getDeckCardCount(cardName);
      if (count <= 0) {
        button.classList.add('hidden'); // 非表示などの状態を再適用
      } else {
        button.classList.remove('hidden');
      }
    });
  }
  

// デッキ編集時のカードリストを読み込み
function renderCardPool() {
    const containerElement = document.getElementById('card-pool-list');
    if (!containerElement) return;

    containerElement.innerHTML = '';

    cardList.forEach(card => {
        const cardElement = createCardElement(card, {
            extraClass: 'pool-card simple-mode',
            mode: 'simple',
            onAdd: (card) => addCardToDeck(card.名前),
            onRemove: (card) => removeCardFromDeck(card.名前)
        });

        containerElement.appendChild(cardElement);
    });
}



// デッキ情報を更新する関数
function updateDeckHeader() {
    const deckListContainer = document.getElementById('deck-pool-list');
    deckListContainer.innerHTML = '';

    Object.entries(deck).forEach(([cardName, count]) => {
        const cardData = cardList.find(c => c.名前 === cardName);
        if (!cardData) return;

        // ベースのカードUIを生成
        const cardElement = createCardElement(cardData, {
            extraClass: 'deck-card',
            mode: 'simple',
            onAdd: (card) => addCardToDeck(card.名前),
            onRemove: (card) => removeCardFromDeck(card.名前)
            // alwaysShowButtons: true // ← 新しいフラグを使う（後述）
          });

        // 枚数表示
        const countLabel = document.createElement('span');
        countLabel.className = 'card-count';
        countLabel.textContent = `x${count}`;
        cardElement.appendChild(countLabel);

        deckListContainer.appendChild(cardElement);
    });
}

